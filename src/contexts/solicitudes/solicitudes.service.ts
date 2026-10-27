import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, Repository } from "typeorm";
import { PaginatedResult } from "../shared/interfaces/paginated-result.interface";
import { Solicitud, SolicitudStatus } from "./entities/solicitud.entity";
import { FilterSolicitudesDto } from "./dto/filter-solicitudes.dto";
import { UpdateSolicitudDto } from "./dto/update-solicitud.dto";

export interface SolicitudesSummary {
  total: number;
  unread: number;
  byStatus: Record<SolicitudStatus, number>;
}

@Injectable()
export class SolicitudesService {
  constructor(
    @InjectRepository(Solicitud)
    private readonly solicitudRepository: Repository<Solicitud>,
  ) {}

  async findAll(filters: FilterSolicitudesDto): Promise<PaginatedResult<Solicitud>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const qb = this.solicitudRepository
      .createQueryBuilder("solicitud")
      .leftJoin("solicitud.mailAccount", "account")
      .addSelect(["account.id", "account.email"])
      .orderBy("solicitud.lastMessageAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit);

    if (filters.status) qb.andWhere("solicitud.status = :status", { status: filters.status });
    if (filters.from) {
      qb.andWhere("(solicitud.fromEmail ILIKE :from OR solicitud.fromName ILIKE :from)", { from: `%${filters.from}%` });
    }
    if (filters.dateFrom) qb.andWhere("solicitud.receivedAt >= :dateFrom", { dateFrom: filters.dateFrom });
    if (filters.dateTo) {
      qb.andWhere("solicitud.receivedAt < (CAST(:dateTo AS date) + INTERVAL '1 day')", { dateTo: filters.dateTo });
    }
    if (filters.search) {
      const search = `%${filters.search}%`;
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where("solicitud.subject ILIKE :search", { search })
            .orWhere("solicitud.fromEmail ILIKE :search", { search })
            .orWhere("solicitud.fromName ILIKE :search", { search })
            .orWhere("solicitud.notes ILIKE :search", { search })
            .orWhere(
              `EXISTS (SELECT 1 FROM solicitud_messages m WHERE m."solicitudId" = solicitud.id AND m."bodyText" ILIKE :search)`,
              { search },
            );
        }),
      );
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, lastPage: Math.max(1, Math.ceil(total / limit)), limit } };
  }

  async getSummary(): Promise<SolicitudesSummary> {
    const rows: Array<{ status: SolicitudStatus; count: string; unread: string }> = await this.solicitudRepository
      .createQueryBuilder("solicitud")
      .select("solicitud.status", "status")
      .addSelect("COUNT(*)", "count")
      .addSelect("COUNT(*) FILTER (WHERE solicitud.unread)", "unread")
      .groupBy("solicitud.status")
      .getRawMany();

    const byStatus = Object.fromEntries(Object.values(SolicitudStatus).map((s) => [s, 0])) as Record<SolicitudStatus, number>;
    let total = 0;
    let unread = 0;
    for (const row of rows) {
      byStatus[row.status] = Number(row.count);
      total += Number(row.count);
      unread += Number(row.unread);
    }
    return { total, unread, byStatus };
  }

  /** Full solicitud with its thread. Opening it marks it as read. */
  async findOne(id: number): Promise<Solicitud> {
    const solicitud = await this.solicitudRepository
      .createQueryBuilder("solicitud")
      .leftJoin("solicitud.mailAccount", "account")
      .addSelect(["account.id", "account.email"])
      .leftJoinAndSelect("solicitud.messages", "message")
      .leftJoinAndSelect("message.attachments", "attachment")
      .where("solicitud.id = :id", { id })
      .orderBy("message.sentAt", "ASC")
      .addOrderBy("attachment.id", "ASC")
      .getOne();
    if (!solicitud) throw new NotFoundException(`Solicitud ${id} no encontrada`);

    if (solicitud.unread) {
      await this.solicitudRepository.update(id, { unread: false });
      solicitud.unread = false;
    }
    return solicitud;
  }

  async update(id: number, dto: UpdateSolicitudDto): Promise<Solicitud> {
    const solicitud = await this.solicitudRepository.findOne({ where: { id } });
    if (!solicitud) throw new NotFoundException(`Solicitud ${id} no encontrada`);

    if (dto.status !== undefined) solicitud.status = dto.status;
    if (dto.assignee !== undefined) solicitud.assignee = dto.assignee?.trim() || null;
    if (dto.notes !== undefined) solicitud.notes = dto.notes?.trim() || null;
    await this.solicitudRepository.save(solicitud);
    return this.findOne(id);
  }
}
