import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

/**
 * Casilla de correo conectada por OAuth. Solo se guarda el refresh token cifrado,
 * nunca la contraseña.
 */
@Entity("mail_accounts")
export class MailAccount {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 255, unique: true })
  email!: string;

  @Column({ type: "varchar", length: 20, default: "gmail" })
  provider!: string;

  /** Refresh token de OAuth cifrado con AES-256-GCM (ver token-cipher.ts). */
  @Column({ type: "text", nullable: true, select: false })
  encryptedRefreshToken?: string | null;

  /** Etiquetas de Gmail (separadas por coma) cuyos hilos se registran como solicitudes. */
  @Column({ type: "varchar", length: 100, default: "Solicitudes,Cotizaciones" })
  labelName!: string;

  /** Only threads started from this date on are imported (a week before connecting). */
  @Column({ type: "timestamp", nullable: true })
  importSince?: Date | null;

  @Column({ type: "boolean", default: true })
  active!: boolean;

  /** El permiso fue revocado o venció: hay que volver a conectar la casilla. */
  @Column({ type: "boolean", default: false })
  needsReconnect!: boolean;

  @Column({ type: "timestamp", nullable: true })
  lastSyncAt?: Date | null;

  @Column({ type: "text", nullable: true })
  lastError?: string | null;

  @Column({ type: "timestamp", nullable: true })
  lastErrorAt?: Date | null;

  @Column({ type: "int", default: 0 })
  consecutiveFailures!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
