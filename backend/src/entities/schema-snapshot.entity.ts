import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('schema_snapshots')
export class SchemaSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  connectionId!: string;

  @Column('varchar', { length: 255 })
  database!: string;

  @Column('varchar', { length: 255, default: 'public' })
  schema!: string;

  @Column('jsonb')
  snapshot!: Record<string, any>;

  @Column('jsonb', { nullable: true })
  diff!: Record<string, any> | null;

  @Column('varchar', { length: 255, nullable: true })
  label!: string | null;

  @Column('text', { nullable: true })
  notes!: string | null;

  @CreateDateColumn()
  capturedAt!: Date;
}
