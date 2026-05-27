import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('audit_logs_v2')
export class AuditLogV2 {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('varchar', { length: 100 })
  tableName!: string;

  @Column('uuid', { nullable: true })
  recordId!: string | null;

  @Column('varchar', { length: 20 })
  action!: string; // create, update, delete, restore

  @Column('uuid', { nullable: true })
  userId!: string | null;

  @Column('varchar', { length: 100, nullable: true })
  userName!: string | null;

  @Column('uuid', { nullable: true })
  clientId!: string | null;

  @Column('simple-json', { nullable: true })
  changes!: any; // { field: { old, new } }

  @Column('simple-json', { nullable: true })
  metadata!: any; // { ip, userAgent, sessionId }

  @CreateDateColumn()
  timestamp!: Date;
}
