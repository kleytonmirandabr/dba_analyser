import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type AuditAction = 'LOGIN' | 'LOGOUT' | 'QUERY' | 'EXECUTE' | 'APPROVE' | 'REJECT' | 'KILL' | 'CONFIG_CHANGE' | 'VPN_CONNECT' | 'VPN_DISCONNECT';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column('uuid')
  userId!: string;

  @Column({ length: 50 })
  action!: AuditAction;

  @Column('uuid', { nullable: true })
  connectionId!: string | null;

  @Column({ length: 255, nullable: true })
  targetObject!: string | null;

  @Column('text', { nullable: true })
  sqlText!: string | null;

  @Column({ length: 20, nullable: true })
  result!: string | null;

  @Column('text', { nullable: true })
  errorMessage!: string | null;

  @Column('int', { nullable: true })
  durationMs!: number | null;

  @Column({ length: 45, nullable: true })
  ipAddress!: string | null;

  @Column('jsonb', { nullable: true })
  metadata!: Record<string, any> | null;

  @CreateDateColumn()
  createdAt!: Date;
}
