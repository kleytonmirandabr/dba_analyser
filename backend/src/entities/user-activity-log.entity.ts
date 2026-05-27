import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

export type UserAction = 'login' | 'logout' | 'login_failed' | 'password_changed' | 'profile_changed' | 'locked' | 'unlocked';

@Entity('user_activity_logs')
export class UserActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column('varchar', { length: 30 })
  action!: UserAction;

  @Column('varchar', { length: 45, nullable: true })
  ip!: string | null;

  @Column('text', { nullable: true })
  userAgent!: string | null;

  @Column('simple-json', { nullable: true })
  details!: any;

  @CreateDateColumn()
  timestamp!: Date;
}
