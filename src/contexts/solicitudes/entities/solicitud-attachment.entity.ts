import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { SolicitudMessage } from "./solicitud-message.entity";

/**
 * Adjunto de un mail. El archivo queda en Gmail y se descarga a pedido,
 * así los datos del correo no se copian a otro almacenamiento.
 */
@Entity("solicitud_attachments")
@Index(["messageId"])
export class SolicitudAttachment {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => SolicitudMessage, (message) => message.attachments, { onDelete: "CASCADE" })
  @JoinColumn({ name: "messageId" })
  message?: SolicitudMessage;

  @Column({ type: "int" })
  messageId!: number;

  @Column({ type: "text", select: false })
  gmailAttachmentId!: string;

  @Column({ type: "varchar", length: 500 })
  filename!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  mimeType?: string | null;

  @Column({ type: "int", default: 0 })
  size!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
