import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Profile } from './profile.entity';
import { Feature } from './feature.entity';

@Entity('profile_features')
export class ProfileFeature {
  @PrimaryColumn('uuid')
  profileId!: string;

  @PrimaryColumn('varchar', { length: 100 })
  featureCode!: string;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profileId' })
  profile!: Profile;

  @ManyToOne(() => Feature, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'featureCode', referencedColumnName: 'code' })
  feature!: Feature;

  @CreateDateColumn()
  grantedAt!: Date;

  @Column('uuid', { nullable: true })
  grantedById!: string | null;
}
