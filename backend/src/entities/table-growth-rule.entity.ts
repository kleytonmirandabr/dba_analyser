import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Connection } from './connection.entity';

@Entity('table_growth_rules')
export class TableGrowthRule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  connectionId!: string;

  @ManyToOne(() => Connection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'connectionId' })
  connection!: Connection;

  @Column('varchar', { length: 100 })
  schemaName!: string;

  @Column('varchar', { length: 200 })
  tableName!: string;

  @Column('float', { default: 300 })
  maxDailyGrowthPct!: number;

  @Column('bigint', { nullable: true })
  maxDailyGrowthRows!: number | null;

  @Column('bigint', { nullable: true })
  minDailyGrowthRows!: number | null;

  @Column('float', { default: 10 })
  maxShrinkPct!: number;

  @Column({ default: true })
  enabled!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
