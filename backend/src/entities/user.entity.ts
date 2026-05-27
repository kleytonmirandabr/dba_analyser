import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Client } from './client.entity';
import { Profile } from './profile.entity';

export type UserRole = 'admin' | 'dba' | 'viewer'; // deprecated, kept for migration

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ length: 50, unique: true })
  username!: string;

  @Column({ length: 255, unique: true, nullable: true, type: 'varchar' })
  email!: string | null;

  @Column({ length: 255 })
  passwordHash!: string;

  // Deprecated: use profileId instead. Kept for backwards compat during migration
  @Column({ length: 20, default: 'viewer' })
  role!: UserRole;

  @Column('uuid', { nullable: true })
  clientId!: string | null;

  @ManyToOne(() => Client, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'clientId' })
  client!: Client | null;

  @Column('uuid', { nullable: true })
  profileId!: string | null;

  @ManyToOne(() => Profile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'profileId' })
  profile!: Profile | null;

  @Column('varchar', { length: 10, nullable: true })
  preferredLanguage!: string | null;

  @Column('varchar', { length: 50, nullable: true })
  preferredTimezone!: string | null;

  @Column('text', { nullable: true })
  avatar!: string | null;

  @Column('varchar', { length: 30, nullable: true })
  phone!: string | null;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ default: 0 })
  failedLoginAttempts!: number;

  @Column({ type: 'timestamp', nullable: true })
  lockedUntil!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @Column('uuid', { nullable: true })
  createdById!: string | null;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column('uuid', { nullable: true })
  updatedById!: string | null;

  @DeleteDateColumn({ nullable: true })
  deletedAt!: Date | null;

  @Column('uuid', { nullable: true })
  deletedById!: string | null;

  @Column({ default: false })
  isDeleted!: boolean;
}
