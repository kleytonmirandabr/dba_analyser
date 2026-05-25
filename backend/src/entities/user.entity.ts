import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type UserRole = 'admin' | 'dba' | 'viewer';

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

  @Column({ length: 20, default: 'viewer' })
  role!: UserRole;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ default: 0 })
  failedLoginAttempts!: number;

  @Column({ type: 'timestamp', nullable: true })
  lockedUntil!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
