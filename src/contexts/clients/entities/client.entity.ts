import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

export class Contact {
  name!: string;
  email!: string;
  phone?: string;
  address?: string;
}

@Entity("clients")
export class Client {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "varchar", length: 50, unique: true })
  identifier!: string;

  @Column({ type: "jsonb" })
  contacts!: Contact[];

  /** Logo shown on the quotation sheet (PNG or JPG). Not loaded unless asked for. */
  @Column({ type: "bytea", nullable: true, select: false })
  logoData?: Buffer | null;

  @Column({ type: "varchar", length: 50, nullable: true })
  logoMimeType?: string | null;

  /** When the logo was last changed; null when the client has no logo */
  @Column({ type: "timestamp", nullable: true })
  logoUpdatedAt?: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

