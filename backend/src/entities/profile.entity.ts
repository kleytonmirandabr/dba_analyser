import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseAuditEntity } from './base-audit.entity';
import { Client } from './client.entity';

@Entity('profiles')
export class Profile extends BaseAuditEntity {
  @Column('varchar', { length: 100 })
  name!: string;

  @Column('text', { nullable: true })
  description!: string | null;

  @Column('uuid', { nullable: true })
  clientId!: string | null;

  @ManyToOne(() => Client, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'clientId' })
  client!: Client | null;

  @Column({ default: false })
  isDefault!: boolean;
}
