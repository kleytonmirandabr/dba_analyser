import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('query_advice')
export class QueryAdvice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  connectionId: string;

  @Column('text')
  originalQuery: string;

  @Column('text', { nullable: true })
  optimizedQuery: string;

  @Column('jsonb')
  explainPlan: any;

  @Column('jsonb')
  suggestions: any[];

  @Column('text')
  summary: string;

  @Column({ length: 20 })
  severity: string; // critical, warning, info, ok

  @Column({ default: false })
  aiPowered: boolean;

  @Column({ nullable: true })
  userId: string;

  @CreateDateColumn()
  createdAt: Date;
}
