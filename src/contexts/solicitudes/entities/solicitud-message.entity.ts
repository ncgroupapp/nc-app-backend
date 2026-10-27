import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Relation,
  Unique,
} from "typeorm";
import { Solicitud } from "./solicitud.entity";
import { SolicitudAttachment } from "./solicitud-attachment.entity";

/** Un mail del hilo de una solicitud (el original o una respuesta). */
@Entity("solicitud_messages")
@Unique("UQ_solicitud_messages_gmail", ["solicitudId", "gmailMessageId"])
@Index(["solicitudId"])
export class SolicitudMessage {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Solicitud, (solicitud) => solicitud.messages, { onDelete: "CASCADE" })
  @JoinColumn({ name: "solicitudId" })
  solicitud?: Relation<Solicitud>;

  @Column({ type: "int" })
  solicitudId!: number;

  @Column({ type: "varchar", length: 64 })
  gmailMessageId!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  fromName?: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  fromEmail?: string | null;

  @Column({ type: "text", nullable: true })
  toRecipients?: string | null;

  @Column({ type: "text", nullable: true })
  ccRecipients?: string | null;

  @Column({ type: "varchar", length: 998, nullable: true })
  subject?: string | null;

  @Column({ type: "timestamp" })
  sentAt!: Date;

  @Column({ type: "text", nullable: true })
  bodyText?: string | null;

  @Column({ type: "text", nullable: true })
  bodyHtml?: string | null;

  /** Enviado desde la casilla conectada (una respuesta nuestra). */
  @Column({ type: "boolean", default: false })
  outgoing!: boolean;

  @OneToMany(() => SolicitudAttachment, (attachment) => attachment.message)
  attachments?: Relation<SolicitudAttachment>[];

  @CreateDateColumn()
  createdAt!: Date;
}
