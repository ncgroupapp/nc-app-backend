import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { CREATE_CERTIFICATES_TABLE_SQL } from "./certificates.table";
import { CertificateStatus, certificateStatus, todayInUruguay } from "./certificate-status";
import { CreateCertificateDto, UpdateCertificateDto } from "./dto/certificate.dto";
import { Certificate } from "./entities/certificate.entity";

export const MAX_CERTIFICATE_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_FILE = /\.(pdf|png|jpe?g|webp)$/i;

export type CertificateView = Omit<Certificate, "fileData"> & { status: CertificateStatus; daysLeft: number | null };

/** Worst first, so what needs attention is on top */
const STATUS_ORDER: Record<CertificateStatus, number> = { vencido: 0, sin_cargar: 1, por_vencer: 2, vigente: 3 };

@Injectable()
export class CertificatesService implements OnModuleInit {
  private readonly logger = new Logger(CertificatesService.name);

  constructor(
    @InjectRepository(Certificate)
    private readonly repository: Repository<Certificate>,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.dataSource.query(CREATE_CERTIFICATES_TABLE_SQL);
    } catch (error) {
      this.logger.error(
        "Could not ensure certificates table",
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async findAll(): Promise<CertificateView[]> {
    const today = todayInUruguay();
    const certificates = await this.repository.find({ order: { requiredForRupe: "DESC", name: "ASC" } });
    return certificates
      .map((certificate) => this.toView(certificate, today))
      .sort(
        (a, b) =>
          STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
          (a.daysLeft ?? 0) - (b.daysLeft ?? 0) ||
          Number(b.requiredForRupe) - Number(a.requiredForRupe),
      );
  }

  async findOne(id: number): Promise<CertificateView> {
    return this.toView(await this.getEntity(id), todayInUruguay());
  }

  async create(dto: CreateCertificateDto): Promise<CertificateView> {
    this.assertDates(dto.issueDate, dto.expiryDate);
    const saved = await this.repository.save(this.repository.create({ ...dto, code: null }));
    return this.findOne(saved.id);
  }

  async update(id: number, dto: UpdateCertificateDto): Promise<CertificateView> {
    const certificate = await this.getEntity(id);
    Object.assign(certificate, dto);
    this.assertDates(certificate.issueDate, certificate.expiryDate);
    await this.repository.save(certificate);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const certificate = await this.getEntity(id);
    if (certificate.code) {
      throw new BadRequestException("Los certificados que pide RUPE no se pueden eliminar; podés quitarles el archivo o las fechas");
    }
    await this.repository.delete(id);
  }

  async attachFile(id: number, file: { fileName: string; mimeType: string; data: Buffer }): Promise<CertificateView> {
    await this.getEntity(id);
    if (!ALLOWED_FILE.test(file.fileName)) throw new BadRequestException("Subí el certificado en PDF o imagen (JPG, PNG)");
    if (file.data.length === 0) throw new BadRequestException("El archivo está vacío");
    await this.repository.update(id, {
      fileName: file.fileName.slice(0, 255),
      mimeType: file.mimeType || "application/octet-stream",
      fileSize: file.data.length,
      fileData: file.data,
    });
    return this.findOne(id);
  }

  async removeFile(id: number): Promise<CertificateView> {
    await this.getEntity(id);
    await this.repository.update(id, { fileName: null, mimeType: null, fileSize: null, fileData: null });
    return this.findOne(id);
  }

  async getFile(id: number): Promise<{ fileName: string; mimeType: string; fileData: Buffer }> {
    const certificate = await this.repository
      .createQueryBuilder("certificate")
      .select(["certificate.id", "certificate.fileName", "certificate.mimeType"])
      .addSelect("certificate.fileData")
      .where("certificate.id = :id", { id })
      .getOne();
    if (!certificate) throw new NotFoundException(`Certificado ${id} no encontrado`);
    if (!certificate.fileData || !certificate.fileName) throw new NotFoundException("El certificado no tiene archivo cargado");
    return {
      fileName: certificate.fileName,
      mimeType: certificate.mimeType ?? "application/octet-stream",
      fileData: certificate.fileData,
    };
  }

  private async getEntity(id: number): Promise<Certificate> {
    const certificate = await this.repository.findOne({ where: { id } });
    if (!certificate) throw new NotFoundException(`Certificado ${id} no encontrado`);
    return certificate;
  }

  private assertDates(issueDate?: string | null, expiryDate?: string | null) {
    if (issueDate && expiryDate && expiryDate.slice(0, 10) < issueDate.slice(0, 10)) {
      throw new BadRequestException("El vencimiento no puede ser anterior a la fecha de emisión");
    }
  }

  private toView(certificate: Certificate, today: string): CertificateView {
    const { fileData: _fileData, ...rest } = certificate;
    return { ...rest, ...certificateStatus(certificate.expiryDate, certificate.alertDays, today) };
  }
}
