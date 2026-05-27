import { PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

export abstract class BaseAuditEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @Column('uuid', { nullable: true })
  createdById!: string | null;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;

  @Column('uuid', { nullable: true })
  updatedById!: string | null;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deletedAt!: Date | null;

  @Column('uuid', { nullable: true })
  deletedById!: string | null;

  @Column({ default: false })
  isDeleted!: boolean;
}
