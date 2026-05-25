import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Connection } from './connection.entity';

@Entity('table_snapshots')
@Unique(['connectionId', 'schemaName', 'tableName', 'snapshotDate'])
export class TableSnapshot {
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

  @Column('bigint', { default: 0 })
  rowCount!: number;

  @Column('bigint', { default: 0 })
  sizeBytes!: number;

  @Column('bigint', { default: 0 })
  deadTuples!: number;

  @Column('date')
  snapshotDate!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
