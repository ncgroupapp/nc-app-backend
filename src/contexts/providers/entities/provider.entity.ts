import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";

export class Contact {
  name!: string;
  email!: string;
  phone?: string;
  address?: string;
}

@Entity("providers")
export class Provider {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 50, unique: true })
  rut!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "varchar", length: 100 })
  country!: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  brand?: string;

  @Column({ type: "jsonb" })
  contacts!: Contact[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

