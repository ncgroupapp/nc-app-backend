import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToMany, JoinTable } from 'typeorm';
import { Provider } from '../../providers/entities/provider.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id!: number;



  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  origin?: string;

  @Column('text', { array: true, nullable: true })
  images?: string[];

  @ManyToMany(() => Provider, { eager: false })
  @JoinTable({
    name: 'product_providers',
    joinColumn: { name: 'productId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'providerId', referencedColumnName: 'id' }
  })
  providers?: Provider[];

  @Column({ type: 'varchar', length: 100, nullable: true })
  brand?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  code?: string;

  @Column('text', { array: true, nullable: true })
  equivalentCodes?: string[];

  @Column({ type: 'int', nullable: true, default: 0 })
  stockQuantity?: number;

  @Column({ type: 'text', nullable: true })
  details?: string;

  @Column({ type: 'text', nullable: true })
  observations?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  chassis?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  motor?: string;

  @Column({ type: 'text', nullable: true })
  equipment?: string;

  @Column({ type: 'json', nullable: true })
  quotationHistory?: any[];

  @Column({ type: 'json', nullable: true })
  adjudicationHistory?: any[];

  // Legacy fields for backward compatibility
  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'int', nullable: true, default: 0 })
  stock?: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
