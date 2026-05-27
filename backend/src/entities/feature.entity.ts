import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('features')
export class Feature {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('varchar', { length: 100, unique: true })
  code!: string;

  @Column('varchar', { length: 150 })
  name!: string;

  @Column('text', { nullable: true })
  description!: string | null;

  @Column('varchar', { length: 50 })
  module!: string;

  @Column('int', { default: 0 })
  moduleOrder!: number;

  @Column('int', { default: 0 })
  featureOrder!: number;

  @CreateDateColumn()
  registeredAt!: Date;
}
