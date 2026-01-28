import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Brand } from './brand.entity';

@Entity('brand_models')
export class BrandModel {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ nullable: true })
  brandId!: number | null;

  @ManyToOne('Brand', (brand: Brand) => brand.models, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'brandId' })
  brand!: Brand;
  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
