import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('manuals')
export class Manual {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id!: number;

  @ApiProperty({ example: 'Manual de Usuario' })
  @Column()
  name!: string;

  @ApiProperty({ example: 'This manual describes how to use the system features.', nullable: true })
  @Column({ nullable: true })
  description?: string;

  @ApiProperty({ example: 'https://firebasestorage.googleapis.com/v0/b/project.appspot.com/o/manuals%2Fuser-guide.pdf' })
  @Column()
  fileUrl!: string;

  @ApiProperty({ example: '2023-12-05T10:00:00Z' })
  @CreateDateColumn()
  createdAt!: Date;

  @ApiProperty({ example: '2023-12-05T10:00:00Z' })
  @UpdateDateColumn()
  updatedAt!: Date;
}
