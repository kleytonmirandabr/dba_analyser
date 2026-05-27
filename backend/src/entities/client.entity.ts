import { Entity, Column } from 'typeorm';
import { BaseAuditEntity } from './base-audit.entity';

@Entity('clients')
export class Client extends BaseAuditEntity {
  @Column('varchar', { length: 150 })
  name!: string;

  @Column('varchar', { length: 50, unique: true })
  code!: string;

  @Column('varchar', { length: 50 })
  timezone!: string;

  @Column('varchar', { length: 10 })
  language!: string;

  @Column('varchar', { length: 5 })
  country!: string;

  @Column('varchar', { length: 20, default: 'DD/MM/YYYY' })
  dateFormat!: string;

  @Column('varchar', { length: 5, default: '24h' })
  timeFormat!: string;

  @Column('text', { nullable: true })
  logo!: string | null;

  @Column('varchar', { length: 150, nullable: true })
  primaryContact!: string | null;

  @Column('varchar', { length: 255, nullable: true })
  contactEmail!: string | null;

  @Column('date', { nullable: true })
  contractStart!: Date | null;

  @Column('date', { nullable: true })
  contractEnd!: Date | null;

  @Column('int', { default: 10 })
  maxUsers!: number;

  @Column('int', { default: 20 })
  maxConnections!: number;

  @Column('text', { nullable: true })
  notes!: string | null;

  @Column({ default: true })
  isActive!: boolean;
}
