import { Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, DataSource, In, Repository } from "typeorm";
import { Remito, RemitoItem, RemitoStatus } from "./entities/remito.entity";
import { ShippingGuide } from "./entities/shipping-guide.entity";
import { CreateRemitoDto, FilterRemitosDto, RemitoItemDto, UpdateRemitoDto } from "./dto/remito.dto";
import { CreateShippingGuideDto, UpdateShippingGuideDto } from "./dto/shipping-guide.dto";
import { Licitation } from "../licitations/entities/licitation.entity";
import { Quotation, QuotationAwardStatus } from "../quotation/entities/quotation.entity";

/** Tables are created on startup because migrations are not run on deploy. */
const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS "remitos" (
    "id" SERIAL PRIMARY KEY,
    "number" integer NOT NULL UNIQUE,
    "date" date NOT NULL,
    "clientId" integer,
    "licitationId" integer,
    "receiverName" character varying(255) NOT NULL,
    "receiverRut" character varying(50),
    "receiverAddress" character varying(255),
    "receiverCity" character varying(255),
    "receiverPhone" character varying(100),
    "purchaseOrder" character varying(100),
    "reference" character varying(255),
    "notes" text,
    "status" character varying(20) NOT NULL DEFAULT 'emitido',
    "deliveredAt" date,
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS "remito_items" (
    "id" SERIAL PRIMARY KEY,
    "remitoId" integer NOT NULL REFERENCES "remitos"("id") ON DELETE CASCADE,
    "position" integer NOT NULL DEFAULT 0,
    "productId" integer,
    "code" character varying(100),
    "description" character varying(500) NOT NULL,
    "quantity" numeric(12,2) NOT NULL
  );
  CREATE INDEX IF NOT EXISTS "IDX_remito_items_remitoId" ON "remito_items" ("remitoId");
  CREATE TABLE IF NOT EXISTS "shipping_guides" (
    "id" SERIAL PRIMARY KEY,
    "recipientName" character varying(255) NOT NULL,
    "recipientPhone" character varying(100),
    "addressLines" jsonb NOT NULL DEFAULT '[]',
    "senderName" character varying(255) NOT NULL DEFAULT 'NC GROUP SAS',
    "senderPhone" character varying(100),
    "senderRut" character varying(50),
    "clientId" integer,
    "remitoId" integer,
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
  );
`;

const TIME_ZONE = "America/Montevideo";

/** NC Group as the sender, as on the printed labels. */
const SENDER_DEFAULTS = { name: "NC GROUP SAS", phone: "095604331", rut: "190323070010" };

/** Today in Uruguay as YYYY-MM-DD. */
function today(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

export interface RemitoDraft extends Omit<CreateRemitoDto, "items"> {
  items: RemitoItemDto[];
}

@Injectable()
export class RemitosService implements OnModuleInit {
  private readonly logger = new Logger(RemitosService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Remito) private readonly remitoRepository: Repository<Remito>,
    @InjectRepository(ShippingGuide) private readonly guideRepository: Repository<ShippingGuide>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.dataSource.query(CREATE_TABLES_SQL);
    } catch (error) {
      this.logger.error("Could not ensure remitos tables", error instanceof Error ? error.stack : String(error));
    }
  }

  // ===== Remitos =====

  async findAll(filters: FilterRemitosDto): Promise<Remito[]> {
    const query = this.remitoRepository
      .createQueryBuilder("remito")
      .leftJoinAndSelect("remito.items", "item")
      .orderBy("remito.number", "DESC")
      .addOrderBy("item.position", "ASC");

    if (filters.status) {
      query.andWhere("remito.status = :status", { status: filters.status });
    }
    const search = filters.search?.trim();
    if (search) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where("remito.receiverName ILIKE :search", { search: `%${search}%` })
            .orWhere("remito.purchaseOrder ILIKE :search", { search: `%${search}%` })
            .orWhere("CAST(remito.number AS text) = :exact", { exact: search.replace(/^0+/, "") });
        }),
      );
    }
    return query.getMany();
  }

  async findOne(id: number): Promise<Remito> {
    const remito = await this.remitoRepository
      .createQueryBuilder("remito")
      .leftJoinAndSelect("remito.items", "item")
      .where("remito.id = :id", { id })
      .orderBy("item.position", "ASC")
      .getOne();
    if (!remito) throw new NotFoundException(`Remito ${id} no encontrado`);
    return remito;
  }

  async create(dto: CreateRemitoDto): Promise<Remito> {
    const id = await this.dataSource.transaction(async (manager) => {
      // Serialize number allocation so two remitos never get the same number
      await manager.query(`LOCK TABLE "remitos" IN SHARE ROW EXCLUSIVE MODE`);
      const [{ next }] = await manager.query(`SELECT COALESCE(MAX("number"), 0) + 1 AS next FROM "remitos"`);
      const { items, ...fields } = dto;
      const remito = manager.create(Remito, {
        ...fields,
        date: dto.date ?? today(),
        number: Number(next),
        status: RemitoStatus.ISSUED,
        items: this.toItems(items),
      });
      const saved = await manager.save(remito);
      return saved.id;
    });
    return this.findOne(id);
  }

  async update(id: number, dto: UpdateRemitoDto): Promise<Remito> {
    const remito = await this.findOne(id);
    const { items, ...fields } = dto;

    await this.dataSource.transaction(async (manager) => {
      if (dto.status === RemitoStatus.DELIVERED && !dto.deliveredAt && !remito.deliveredAt) {
        fields.deliveredAt = today();
      }
      if (Object.keys(fields).length > 0) {
        await manager.update(Remito, id, fields);
      }
      if (items) {
        await manager.delete(RemitoItem, { remitoId: id });
        await manager.save(this.toItems(items).map((item) => manager.create(RemitoItem, { ...item, remitoId: id })));
      }
    });
    return this.findOne(id);
  }

  /**
   * Prefills a remito from a licitation: client data, the call number as reference and the
   * items of its latest quotation (only the awarded ones when the licitation was adjudicated).
   */
  async draftFromLicitation(licitationId: number): Promise<RemitoDraft> {
    const licitation = await this.dataSource.getRepository(Licitation).findOne({
      where: { id: licitationId },
      relations: { client: true },
    });
    if (!licitation) throw new NotFoundException(`Licitación ${licitationId} no encontrada`);

    const quotation = await this.dataSource.getRepository(Quotation).findOne({
      where: { licitationId },
      relations: { items: { product: true } },
      order: { createdAt: "DESC", items: { id: "ASC" } },
    });

    const allItems = quotation?.items ?? [];
    const awardedStatuses = [QuotationAwardStatus.AWARDED, QuotationAwardStatus.PARTIALLY_AWARDED];
    const awarded = allItems.filter((item) => awardedStatuses.includes(item.awardStatus));
    const source = awarded.length > 0 ? awarded : allItems;

    const client = licitation.client;
    const contact = client?.contacts?.find((c) => c.address) ?? client?.contacts?.[0];

    return {
      clientId: licitation.clientId,
      licitationId,
      receiverName: client?.name ?? quotation?.clientName ?? "",
      receiverRut: client?.identifier ?? null,
      receiverAddress: contact?.address ?? null,
      receiverCity: null,
      receiverPhone: contact?.phone ?? null,
      purchaseOrder: quotation?.associatedPurchase || null,
      reference: [licitation.callNumber, licitation.internalNumber].filter(Boolean).join(" · ") || null,
      notes: null,
      items: source.map((item) => ({
        productId: item.productId ?? null,
        code: item.product?.code?.trim() || null,
        description: item.productName,
        quantity: Number(
          item.awardStatus === QuotationAwardStatus.PARTIALLY_AWARDED && item.awardedQuantity
            ? item.awardedQuantity
            : item.quantity,
        ),
      })),
    };
  }

  private toItems(items: RemitoItemDto[]): Partial<RemitoItem>[] {
    return items.map((item, index) => ({
      position: index,
      productId: item.productId ?? null,
      code: item.code?.trim() || null,
      description: item.description.trim(),
      quantity: item.quantity,
    }));
  }

  // ===== Guías de envío =====

  async findGuides(search?: string): Promise<ShippingGuide[]> {
    const query = this.guideRepository.createQueryBuilder("guide").orderBy("guide.id", "DESC");
    if (search?.trim()) {
      query.where("guide.recipientName ILIKE :search", { search: `%${search.trim()}%` });
    }
    return query.getMany();
  }

  async findGuide(id: number): Promise<ShippingGuide> {
    const guide = await this.guideRepository.findOneBy({ id });
    if (!guide) throw new NotFoundException(`Guía de envío ${id} no encontrada`);
    return guide;
  }

  /** Guides in the requested order (the PDF prints them in that order). */
  async findGuidesByIds(ids: number[]): Promise<ShippingGuide[]> {
    const guides = await this.guideRepository.findBy({ id: In(ids) });
    const byId = new Map(guides.map((guide) => [guide.id, guide]));
    const ordered = ids.map((id) => byId.get(id)).filter((guide): guide is ShippingGuide => Boolean(guide));
    if (ordered.length === 0) throw new NotFoundException("No se encontraron guías de envío");
    return ordered;
  }

  async createGuide(dto: CreateShippingGuideDto): Promise<ShippingGuide> {
    const guide = this.guideRepository.create({
      senderName: SENDER_DEFAULTS.name,
      senderPhone: SENDER_DEFAULTS.phone,
      senderRut: SENDER_DEFAULTS.rut,
      ...dto,
      addressLines: this.cleanLines(dto.addressLines),
    });
    return this.guideRepository.save(guide);
  }

  async updateGuide(id: number, dto: UpdateShippingGuideDto): Promise<ShippingGuide> {
    const guide = await this.findGuide(id);
    Object.assign(guide, dto);
    if (dto.addressLines) guide.addressLines = this.cleanLines(dto.addressLines);
    return this.guideRepository.save(guide);
  }

  async removeGuide(id: number): Promise<void> {
    const guide = await this.findGuide(id);
    await this.guideRepository.remove(guide);
  }

  private cleanLines(lines?: string[]): string[] {
    return (lines ?? []).map((line) => line.trim()).filter(Boolean);
  }
}
