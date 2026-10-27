/**
 * Minimal client for Google OAuth 2.0 and the Gmail REST API (read-only).
 * Uses fetch directly to avoid pulling the full googleapis SDK.
 */

export const GMAIL_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
];

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
}

export interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailMessagePart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { attachmentId?: string; size?: number; data?: string };
  parts?: GmailMessagePart[];
}

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailMessagePart;
}

export interface GmailThread {
  id: string;
  historyId?: string;
  snippet?: string;
  messages?: GmailMessage[];
}

/** Error from Google: `authRevoked` means the refresh token is no longer valid. */
export class GoogleApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly authRevoked = false,
  ) {
    super(message);
  }
}

async function parseError(response: Response): Promise<GoogleApiError> {
  const text = await response.text().catch(() => "");
  let detail = text.slice(0, 300);
  let revoked = false;
  try {
    const json = JSON.parse(text) as { error?: string | { message?: string }; error_description?: string };
    if (typeof json.error === "string") {
      revoked = json.error === "invalid_grant";
      detail = json.error_description ?? json.error;
    } else if (json.error?.message) {
      detail = json.error.message;
    }
  } catch {
    // not JSON, keep raw text
  }
  return new GoogleApiError(`Google respondió ${response.status}: ${detail}`, response.status, revoked);
}

export function buildAuthUrl(config: GoogleOAuthConfig, state: string, loginHint?: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline",
    // Always ask for consent so Google returns a refresh token on every connection
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  if (loginHint) params.set("login_hint", loginHint);
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(config: GoogleOAuthConfig, code: string): Promise<TokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as TokenResponse;
}

export async function refreshAccessToken(config: GoogleOAuthConfig, refreshToken: string): Promise<TokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as TokenResponse;
}

export async function revokeToken(token: string): Promise<void> {
  await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
}

/** Reads the email from the id_token returned by Google (already validated by the TLS exchange). */
export function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  const payload = idToken.split(".")[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { email?: string };
    return json.email?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

async function gmailGet<T>(accessToken: string, path: string): Promise<T> {
  const response = await fetch(`${GMAIL_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as T;
}

export async function listLabels(accessToken: string): Promise<Array<{ id: string; name: string }>> {
  const result = await gmailGet<{ labels?: Array<{ id: string; name: string }> }>(accessToken, "/labels");
  return result.labels ?? [];
}

export async function listThreads(
  accessToken: string,
  labelId: string,
  pageToken?: string,
  query?: string,
): Promise<{ threads: Array<{ id: string; historyId?: string }>; nextPageToken?: string }> {
  const params = new URLSearchParams({ labelIds: labelId, maxResults: "100" });
  if (pageToken) params.set("pageToken", pageToken);
  if (query) params.set("q", query);
  const result = await gmailGet<{ threads?: Array<{ id: string; historyId?: string }>; nextPageToken?: string }>(
    accessToken,
    `/threads?${params.toString()}`,
  );
  return { threads: result.threads ?? [], nextPageToken: result.nextPageToken };
}

export async function getThread(accessToken: string, threadId: string): Promise<GmailThread> {
  return gmailGet<GmailThread>(accessToken, `/threads/${encodeURIComponent(threadId)}?format=full`);
}

export async function getAttachment(accessToken: string, messageId: string, attachmentId: string): Promise<Buffer> {
  const result = await gmailGet<{ data?: string }>(
    accessToken,
    `/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
  );
  return Buffer.from(result.data ?? "", "base64url");
}

// --- Message parsing helpers ---

export function header(message: GmailMessage, name: string): string | null {
  const found = message.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return found?.value ?? null;
}

/** Parses `"Juan Pérez" <juan@x.com>` into name and email. */
export function parseAddress(value: string | null): { name: string | null; email: string | null } {
  if (!value) return { name: null, email: null };
  const match = value.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (match) {
    const name = match[1]?.trim() || null;
    return { name, email: match[2]?.trim().toLowerCase() ?? null };
  }
  return { name: null, email: value.trim().toLowerCase() };
}

function decodeBody(data: string | undefined): string {
  return data ? Buffer.from(data, "base64url").toString("utf8") : "";
}

export interface ParsedBody {
  text: string | null;
  html: string | null;
  attachments: Array<{ attachmentId: string; filename: string; mimeType: string | null; size: number }>;
}

export function parseBody(message: GmailMessage): ParsedBody {
  const result: ParsedBody = { text: null, html: null, attachments: [] };

  const walk = (part: GmailMessagePart | undefined): void => {
    if (!part) return;
    if (part.filename && part.body?.attachmentId) {
      result.attachments.push({
        attachmentId: part.body.attachmentId,
        filename: part.filename,
        mimeType: part.mimeType ?? null,
        size: part.body.size ?? 0,
      });
      return;
    }
    if (part.mimeType === "text/plain" && result.text === null && part.body?.data) {
      result.text = decodeBody(part.body.data);
    } else if (part.mimeType === "text/html" && result.html === null && part.body?.data) {
      result.html = decodeBody(part.body.data);
    }
    part.parts?.forEach(walk);
  };

  walk(message.payload);

  if (result.text === null && result.html) {
    result.text = htmlToText(result.html);
  }
  return result;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
