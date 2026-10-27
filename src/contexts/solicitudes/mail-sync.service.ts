import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import jwt from "jsonwebtoken";
import { DataSource, In, Repository } from "typeorm";
import { MailAccount } from "./entities/mail-account.entity";
import { Solicitud } from "./entities/solicitud.entity";
import { SolicitudMessage } from "./entities/solicitud-message.entity";
import { SolicitudAttachment } from "./entities/solicitud-attachment.entity";
import {
  GmailMessage,
  GoogleApiError,
  GoogleOAuthConfig,
  buildAuthUrl,
  emailFromIdToken,
  exchangeCode,
  getAttachment,
  getThread,
  header,
  listLabels,
  listThreads,
  parseAddress,
  parseBody,
  refreshAccessToken,
  revokeToken,
} from "./gmail.client";
import { TokenCipher } from "./token-cipher";
import { CREATE_SOLICITUDES_TABLES_SQL } from "./solicitudes.tables";

const DEFAULT_SYNC_INTERVAL_MS = 2 * 60 * 1000;
/** Max pages of 100 threads read per sync (the first sync of a busy label). */
const MAX_THREAD_PAGES = 5;
/** Longest pause after repeated failures: 30 sync cycles (~1 hour with the default interval). */
const MAX_BACKOFF_CYCLES = 30;

export interface MailAccountView {
  id: number;
  email: string;
  labelName: string;
  active: boolean;
  needsReconnect: boolean;
  lastSyncAt: Date | null;
  lastError: string | null;
  lastErrorAt: Date | null;
}

interface CachedAccessToken {
  token: string;
  expiresAt: number;
}

/**
 * Connects Gmail mailboxes by OAuth and periodically imports the threads that
 * carry the configured label as solicitudes. Failures are recorded on the
 * account and retried with backoff; the rest of the app keeps working.
 */
@Injectable()
export class MailSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MailSyncService.name);
  private readonly cipher: TokenCipher;
  private readonly accessTokens = new Map<number, CachedAccessToken>();
  private readonly skipCycles = new Map<number, number>();
  private timer: NodeJS.Timeout | null = null;
  private syncing = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    @InjectRepository(MailAccount)
    private readonly accountRepository: Repository<MailAccount>,
    @InjectRepository(Solicitud)
    private readonly solicitudRepository: Repository<Solicitud>,
    @InjectRepository(SolicitudMessage)
    private readonly messageRepository: Repository<SolicitudMessage>,
    @InjectRepository(SolicitudAttachment)
    private readonly attachmentRepository: Repository<SolicitudAttachment>,
  ) {
    this.cipher = new TokenCipher(this.serverSecret());
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.dataSource.query(CREATE_SOLICITUDES_TABLES_SQL);
    } catch (error) {
      this.logger.error("Could not ensure solicitudes tables", error instanceof Error ? error.stack : String(error));
    }

    if (this.configService.get<string>("MAIL_SYNC_ENABLED") === "false") {
      this.logger.log("Mail sync disabled (MAIL_SYNC_ENABLED=false)");
      return;
    }
    const interval = Number(this.configService.get<string>("MAIL_SYNC_INTERVAL_MS")) || DEFAULT_SYNC_INTERVAL_MS;
    this.timer = setInterval(() => void this.syncAll(), interval);
    // First run shortly after startup, without delaying boot
    setTimeout(() => void this.syncAll(), 15_000).unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  // --- OAuth connection ---

  isConfigured(): boolean {
    return Boolean(this.configService.get<string>("GOOGLE_CLIENT_ID") && this.configService.get<string>("GOOGLE_CLIENT_SECRET"));
  }

  getConnectUrl(userId: string | number, loginHint?: string): string {
    const config = this.oauthConfig();
    const state = jwt.sign({ purpose: "mail-connect", sub: userId }, this.serverSecret(), { expiresIn: "15m" });
    return buildAuthUrl(config, state, loginHint);
  }

  /** Handles Google's redirect; returns the frontend URL to send the browser to. */
  async handleCallback(code: string | undefined, state: string | undefined, oauthError?: string): Promise<string> {
    const front = this.frontUrl();
    const back = (result: string, detail?: string) => {
      const params = new URLSearchParams({ mail: result });
      if (detail) params.set("detalle", detail);
      return `${front}/dashboard/solicitudes?${params.toString()}`;
    };

    if (oauthError) return back("cancelado", oauthError);
    if (!code || !state) return back("error", "Faltan datos de la respuesta de Google");

    try {
      const payload = jwt.verify(state, this.serverSecret()) as { purpose?: string };
      if (payload.purpose !== "mail-connect") throw new Error("purpose");
    } catch {
      return back("error", "La solicitud de conexión venció. Probá de nuevo.");
    }

    try {
      const tokens = await exchangeCode(this.oauthConfig(), code);
      const email = emailFromIdToken(tokens.id_token);
      if (!email) return back("error", "Google no devolvió la dirección de correo");
      if (!tokens.refresh_token) return back("error", "Google no devolvió el permiso permanente. Probá de nuevo.");

      let account = await this.accountRepository.findOne({ where: { email } });
      if (!account) account = this.accountRepository.create({ email });
      account.encryptedRefreshToken = this.cipher.encrypt(tokens.refresh_token);
      account.active = true;
      account.needsReconnect = false;
      account.lastError = null;
      account.lastErrorAt = null;
      account.consecutiveFailures = 0;
      account = await this.accountRepository.save(account);

      this.accessTokens.set(account.id, { token: tokens.access_token, expiresAt: Date.now() + (tokens.expires_in - 60) * 1000 });
      this.skipCycles.delete(account.id);
      this.logger.log(`Mail account connected: ${email}`);
      void this.syncAccount(account.id);
      return back("conectado", email);
    } catch (error) {
      this.logger.error(`OAuth callback failed: ${error instanceof Error ? error.message : String(error)}`);
      return back("error", "No se pudo completar la conexión con Google");
    }
  }

  async listAccounts(): Promise<MailAccountView[]> {
    const accounts = await this.accountRepository.find({ order: { email: "ASC" } });
    return accounts.map((account) => ({
      id: account.id,
      email: account.email,
      labelName: account.labelName,
      active: account.active,
      needsReconnect: account.needsReconnect,
      lastSyncAt: account.lastSyncAt ?? null,
      lastError: account.lastError ?? null,
      lastErrorAt: account.lastErrorAt ?? null,
    }));
  }

  /** Revokes the Google permission and stops syncing. Already imported solicitudes are kept. */
  async disconnect(accountId: number): Promise<void> {
    const account = await this.accountRepository
      .createQueryBuilder("account")
      .addSelect("account.encryptedRefreshToken")
      .where("account.id = :id", { id: accountId })
      .getOne();
    if (!account) throw new NotFoundException(`Casilla ${accountId} no encontrada`);

    if (account.encryptedRefreshToken) {
      try {
        await revokeToken(this.cipher.decrypt(account.encryptedRefreshToken));
      } catch (error) {
        this.logger.warn(`Could not revoke token for ${account.email}: ${error instanceof Error ? error.message : error}`);
      }
    }
    await this.accountRepository.update(account.id, { encryptedRefreshToken: null, active: false, needsReconnect: false });
    this.accessTokens.delete(account.id);
    this.logger.log(`Mail account disconnected: ${account.email}`);
  }

  // --- Sync ---

  /** Syncs every active account. Never throws: errors are stored on each account. */
  async syncAll(): Promise<void> {
    if (this.syncing || !this.isConfigured()) return;
    this.syncing = true;
    try {
      const accounts = await this.accountRepository.find({ where: { active: true, needsReconnect: false } });
      for (const account of accounts) {
        const skip = this.skipCycles.get(account.id) ?? 0;
        if (skip > 0) {
          this.skipCycles.set(account.id, skip - 1);
          continue;
        }
        await this.syncAccount(account.id);
      }
    } catch (error) {
      this.logger.error(`Mail sync failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.syncing = false;
    }
  }

  /** Imports new or changed labelled threads of one account. */
  async syncAccount(accountId: number): Promise<{ imported: number; updated: number }> {
    const account = await this.accountRepository.findOne({ where: { id: accountId } });
    if (!account) throw new NotFoundException(`Casilla ${accountId} no encontrada`);

    try {
      const accessToken = await this.getAccessToken(account.id);
      const label = (await listLabels(accessToken)).find(
        (l) => l.name.toLowerCase() === account.labelName.toLowerCase(),
      );
      if (!label) {
        throw new Error(`No existe la etiqueta "${account.labelName}" en ${account.email}`);
      }

      const remoteThreads: Array<{ id: string; historyId?: string }> = [];
      let pageToken: string | undefined;
      for (let page = 0; page < MAX_THREAD_PAGES; page++) {
        const result = await listThreads(accessToken, label.id, pageToken);
        remoteThreads.push(...result.threads);
        pageToken = result.nextPageToken;
        if (!pageToken) break;
      }

      const known = remoteThreads.length
        ? await this.solicitudRepository.find({
            where: { mailAccountId: account.id, gmailThreadId: In(remoteThreads.map((t) => t.id)) },
            select: ["id", "gmailThreadId", "gmailHistoryId"],
          })
        : [];
      const knownByThread = new Map(known.map((s) => [s.gmailThreadId, s]));

      let imported = 0;
      let updated = 0;
      // Oldest first, so solicitudes are created in arrival order
      for (const remote of [...remoteThreads].reverse()) {
        const existing = knownByThread.get(remote.id);
        if (existing && existing.gmailHistoryId === remote.historyId) continue;
        const added = await this.importThread(account, accessToken, remote.id);
        if (existing) {
          if (added > 0) updated++;
        } else {
          imported++;
        }
      }

      await this.accountRepository.update(account.id, {
        lastSyncAt: new Date(),
        lastError: null,
        lastErrorAt: null,
        consecutiveFailures: 0,
      });
      this.skipCycles.delete(account.id);
      if (imported || updated) {
        this.logger.log(`Mail sync ${account.email}: ${imported} new, ${updated} updated`);
      }
      return { imported, updated };
    } catch (error) {
      await this.recordFailure(account, error);
      throw error;
    }
  }

  async downloadAttachment(attachmentId: number): Promise<{ data: Buffer; filename: string; mimeType: string }> {
    const attachment = await this.attachmentRepository
      .createQueryBuilder("attachment")
      .addSelect("attachment.gmailAttachmentId")
      .innerJoinAndSelect("attachment.message", "message")
      .innerJoinAndSelect("message.solicitud", "solicitud")
      .where("attachment.id = :id", { id: attachmentId })
      .getOne();
    if (!attachment?.message?.solicitud) throw new NotFoundException(`Adjunto ${attachmentId} no encontrado`);

    const accessToken = await this.getAccessToken(attachment.message.solicitud.mailAccountId);
    const data = await getAttachment(accessToken, attachment.message.gmailMessageId, attachment.gmailAttachmentId);
    return { data, filename: attachment.filename, mimeType: attachment.mimeType || "application/octet-stream" };
  }

  // --- Internals ---

  /** Downloads a thread and stores the messages not imported yet. Returns how many were added. */
  private async importThread(account: MailAccount, accessToken: string, threadId: string): Promise<number> {
    const thread = await getThread(accessToken, threadId);
    const messages = (thread.messages ?? []).filter((m) => !m.labelIds?.includes("DRAFT"));
    if (messages.length === 0) return 0;

    const sorted = [...messages].sort((a, b) => Number(a.internalDate ?? 0) - Number(b.internalDate ?? 0));
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    const firstFrom = parseAddress(header(first, "From"));

    return this.dataSource.transaction(async (manager) => {
      let solicitud = await manager.findOne(Solicitud, { where: { mailAccountId: account.id, gmailThreadId: threadId } });
      if (!solicitud) {
        solicitud = manager.create(Solicitud, {
          mailAccountId: account.id,
          gmailThreadId: threadId,
          subject: truncate(header(first, "Subject") ?? "(sin asunto)", 998),
          fromName: truncate(firstFrom.name, 255),
          fromEmail: truncate(firstFrom.email, 255),
          receivedAt: messageDate(first),
          lastMessageAt: messageDate(first),
          messagesCount: 0,
          unread: true,
        });
        solicitud = await manager.save(solicitud);
      }

      const existingIds = new Set(
        (await manager.find(SolicitudMessage, { where: { solicitudId: solicitud.id }, select: ["gmailMessageId"] })).map(
          (m) => m.gmailMessageId,
        ),
      );

      let added = 0;
      let incomingAdded = false;
      for (const message of sorted) {
        if (existingIds.has(message.id)) continue;
        const from = parseAddress(header(message, "From"));
        const body = parseBody(message);
        const outgoing = from.email === account.email || Boolean(message.labelIds?.includes("SENT"));

        const saved = await manager.save(
          manager.create(SolicitudMessage, {
            solicitudId: solicitud.id,
            gmailMessageId: message.id,
            fromName: truncate(from.name, 255),
            fromEmail: truncate(from.email, 255),
            toRecipients: header(message, "To"),
            ccRecipients: header(message, "Cc"),
            subject: truncate(header(message, "Subject"), 998),
            sentAt: messageDate(message),
            bodyText: body.text,
            bodyHtml: body.html,
            outgoing,
          }),
        );
        if (body.attachments.length) {
          await manager.save(
            body.attachments.map((a) =>
              manager.create(SolicitudAttachment, {
                messageId: saved.id,
                gmailAttachmentId: a.attachmentId,
                filename: truncate(a.filename, 500) ?? "adjunto",
                mimeType: truncate(a.mimeType, 255),
                size: a.size,
              }),
            ),
          );
        }
        added++;
        if (!outgoing) incomingAdded = true;
      }

      solicitud.gmailHistoryId = thread.historyId ?? null;
      solicitud.messagesCount = existingIds.size + added;
      solicitud.lastMessageAt = messageDate(last);
      solicitud.snippet = last.snippet ?? solicitud.snippet ?? null;
      if (incomingAdded) solicitud.unread = true;
      await manager.save(solicitud);
      return added;
    });
  }

  private async getAccessToken(accountId: number): Promise<string> {
    const cached = this.accessTokens.get(accountId);
    if (cached && cached.expiresAt > Date.now()) return cached.token;

    const account = await this.accountRepository
      .createQueryBuilder("account")
      .addSelect("account.encryptedRefreshToken")
      .where("account.id = :id", { id: accountId })
      .getOne();
    if (!account?.encryptedRefreshToken) {
      throw new BadRequestException("La casilla no está conectada");
    }

    const tokens = await refreshAccessToken(this.oauthConfig(), this.cipher.decrypt(account.encryptedRefreshToken));
    this.accessTokens.set(accountId, { token: tokens.access_token, expiresAt: Date.now() + (tokens.expires_in - 60) * 1000 });
    return tokens.access_token;
  }

  private async recordFailure(account: MailAccount, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    const failures = account.consecutiveFailures + 1;
    const revoked = error instanceof GoogleApiError && error.authRevoked;
    this.logger.error(`Mail sync ${account.email} failed (${failures}): ${message}`);

    await this.accountRepository.update(account.id, {
      lastError: revoked ? "Google revocó el permiso: hay que volver a conectar la casilla" : truncate(message, 1000),
      lastErrorAt: new Date(),
      consecutiveFailures: failures,
      needsReconnect: revoked,
    });
    this.accessTokens.delete(account.id);
    // Exponential backoff: skip 1, 2, 4, ... cycles (capped) before trying again
    this.skipCycles.set(account.id, Math.min(2 ** (failures - 1), MAX_BACKOFF_CYCLES) - 1);
  }

  private oauthConfig(): GoogleOAuthConfig {
    const clientId = this.configService.get<string>("GOOGLE_CLIENT_ID");
    const clientSecret = this.configService.get<string>("GOOGLE_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException(
        "Falta configurar GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en el servidor",
      );
    }
    const redirectUri =
      this.configService.get<string>("GOOGLE_REDIRECT_URI") ||
      "https://nc-app-backend-production.up.railway.app/solicitudes/mail/callback";
    return { clientId, clientSecret, redirectUri };
  }

  private serverSecret(): string {
    return (
      this.configService.get<string>("MAIL_TOKEN_SECRET") ||
      this.configService.get<string>("JWT_ACCESS_SECRET") ||
      this.configService.get<string>("JWT_SECRET") ||
      "secretKey"
    );
  }

  private frontUrl(): string {
    return (this.configService.get<string>("FRONT_URL") || "https://nc-app-kappa.vercel.app").replace(/\/+$/, "");
  }
}

function messageDate(message: GmailMessage): Date {
  const ms = Number(message.internalDate);
  return Number.isFinite(ms) && ms > 0 ? new Date(ms) : new Date();
}

function truncate(value: string | null | undefined, max: number): string | null {
  if (value === null || value === undefined) return null;
  return value.length > max ? value.slice(0, max) : value;
}
