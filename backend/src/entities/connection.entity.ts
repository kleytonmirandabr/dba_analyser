import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

export type DbType = 'postgresql' | 'mssql' | 'mysql';
export type Environment = 'dev' | 'hml' | 'prod';
export type ConnectionMode = 'readonly' | 'execute';

@Entity('connections')
export class Connection {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ length: 255 })
  host!: string;

  @Column('int')
  port!: number;

  @Column({ length: 100 })
  databaseName!: string;

  @Column({ length: 100 })
  username!: string;

  @Column('text')
  passwordEncrypted!: string;

  @Column({ length: 64 })
  passwordSalt!: string;

  @Column({ length: 20 })
  dbType!: DbType;

  @Column({ length: 20 })
  environment!: Environment;

  @Column({ length: 20, default: 'readonly' })
  mode!: ConnectionMode;

  @Column({ default: false })
  autoApprove!: boolean;

  @Column('text', { array: true, nullable: true })
  allowedOperations!: string[] | null;

  @Column('text', { array: true, nullable: true })
  blockedOperations!: string[] | null;

  @Column('int', { default: 30000 })
  queryTimeoutMs!: number;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ length: 100, nullable: true })
  groupName!: string | null;

  @Column('uuid', { nullable: true })
  createdById!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy!: User | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
