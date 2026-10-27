import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { MailAccount } from "./mail-account.entity";
import { SolicitudMessage } from "./solicitud-message.entity";

export enum SolicitudStatus {
  NEW = "nueva",
  IN_PROGRESS = "en_proceso",
  RESOLVED = "resuelta",
  CANCELLED = "cancelada",
}

/**
 * Solicitud recibida por mail. Cada hilo de Gmail con la etiqueta "Solicitudes"
 * es una solicitud; las respuestas del mismo hilo se agregan a su historial.
 */
@Entity("solicitudes")
@Unique("UQ_solicitudes_thread", ["mailAccountId", "gmailThreadId"])
@Index(["status"])
export class Solicitud {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => MailAccount, { onDelete: "CASCADE" })
  @JoinColumn({ name: "mailAccountId" })
  mailAccount?: MailAccount;

  @Column({ type: "int" })
  mailAccountId!: number;

  @Column({ type: "varchar", length: 64 })
  gmailThreadId!: string;

  /** historyId del hilo en la última sincronización: si no cambia, no se vuelve a descargar. */
  @Column({ type: "varchar", length: 64, nullable: true })
  gmailHistoryId?: string | null;

  @Column({ type: "varchar", length: 998, nullable: true })
  subject?: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  fromName?: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  fromEmail?: string | null;

  @Column({ type: "timestamp" })
  receivedAt!: Date;

  @Column({ type: "timestamp" })
  lastMessageAt!: Date;

  @Column({ type: "int", default: 0 })
  messagesCount!: number;

  @Column({ type: "text", nullable: true })
  snippet?: string | null;

  @Column({ type: "varchar", length: 20, default: SolicitudStatus.NEW })
  status!: SolicitudStatus;

  @Column({ type: "varchar", length: 255, nullable: true })
  assignee?: string | null;

  @Column({ type: "text", nullable: true })
  notes?: string | null;

  /** Hay mensajes nuevos que todavía no se abrieron en la app. */
  @Column({ type: "boolean", default: true })
  unread!: boolean;

  @OneToMany(() => SolicitudMessage, (message) => message.solicitud)
  messages?: SolicitudMessage[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
