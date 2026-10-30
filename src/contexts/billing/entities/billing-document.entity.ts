import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation, UpdateDateColumn } from "typeorm";
import { Client } from "../../clients/entities/client.entity";

export enum BillingDocumentType {
  INVOICE = "factura",
  CREDIT_NOTE = "nota_credito",
}

/** How the document was linked to a client of the app */
export type BillingClientMatch = "rut" | "nombre" | "manual";

export enum BillingDocumentSource {
  /** Uploaded by the folder agent watching "Ventas NC GROUP" */
  FOLDER = "carpeta",
  /** Uploaded by hand from the app */
  MANUAL = "manual",
}

const decimal = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value === null || value === undefined ? null : Number(value)),
};

/**
 * An invoice or credit note issued by the billing system (Z) and stored together with its file.
 * Fields other than the file are read from the PDF/XML and may be null when they could not be found.
 */
@Entity("billing_documents")
export class BillingDocument {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 20 })
  type!: BillingDocumentType;

  /** DGI CFE type code (111 e-Factura, 112 NC e-Factura, 101 e-Ticket, 102 NC e-Ticket...) */
  @Column({ type: "int", nullable: true })
  cfeType!: number | null;

  @Column({ type: "varchar", length: 10, nullable: true })
  series!: string | null;

  @Column({ type: "varchar", length: 30, nullable: true })
  number!: string | null;

  @Column({ type: "date", nullable: true })
  issueDate!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  clientName!: string | null;

  @Column({ type: "varchar", length: 20, nullable: true })
  clientRut!: string | null;

  /** Client of the app this document belongs to, found by RUT or name, or chosen by hand */
  @Column({ type: "int", nullable: true })
  clientId!: number | null;

  @ManyToOne(() => Client, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "clientId" })
  client?: Relation<Client> | null;

  @Column({ type: "varchar", length: 10, nullable: true })
  clientMatch!: BillingClientMatch | null;

  @Column({ type: "varchar", length: 3, nullable: true })
  currency!: string | null;

  @Column({ type: "numeric", precision: 14, scale: 2, nullable: true, transformer: decimal })
  subtotal!: number | null;

  @Column({ type: "numeric", precision: 14, scale: 2, nullable: true, transformer: decimal })
  tax!: number | null;

  @Column({ type: "numeric", precision: 14, scale: 2, nullable: true, transformer: decimal })
  total!: number | null;

  /** For credit notes: the invoice it refers to (series + number), when present */
  @Column({ type: "varchar", length: 50, nullable: true })
  referenceNumber!: string | null;

  @Column({ type: "varchar", length: 20, default: BillingDocumentSource.FOLDER })
  source!: BillingDocumentSource;

  @Column({ type: "varchar", length: 255 })
  fileName!: string;

  @Column({ type: "varchar", length: 100 })
  mimeType!: string;

  @Column({ type: "int" })
  fileSize!: number;

  /** sha256 of the file, so the same file uploaded twice is stored once */
  @Column({ type: "varchar", length: 64 })
  fileHash!: string;

  @Column({ type: "bytea", select: false })
  fileData!: Buffer;

  /** Text read from the PDF/XML, kept to check documents that could not be understood */
  @Column({ type: "text", nullable: true, select: false })
  rawText!: string | null;

  /** True when number, date or total could not be read and someone should check the document */
  @Column({ type: "boolean", default: false })
  needsReview!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
