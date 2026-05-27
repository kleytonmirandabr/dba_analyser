import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('k8s_clusters')
export class K8sCluster {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ type: 'varchar', default: 'kubeconfig' })
  authMethod!: 'kubeconfig' | 'service_principal';

  // Encrypted kubeconfig content or SP credentials JSON
  @Column({ type: 'text', nullable: true })
  configEncrypted!: string | null;

  // Azure SP fields (encrypted)
  @Column({ type: 'varchar', nullable: true })
  tenantId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  clientId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  clientSecret!: string | null;

  @Column({ type: 'varchar', nullable: true })
  subscriptionId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  resourceGroup!: string | null;

  @Column({ type: 'varchar', nullable: true })
  clusterName!: string | null;

  // Namespaces to monitor (JSON array)
  @Column({ type: 'text', default: '[]' })
  namespaces!: string;

  @Column({ type: 'varchar', nullable: true })
  serverUrl!: string | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'int', default: 1 })
  keyVersion!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Helper to get namespaces as array
  getNamespaces(): string[] {
    try { return JSON.parse(this.namespaces); } catch { return []; }
  }

  setNamespaces(ns: string[]) {
    this.namespaces = JSON.stringify(ns);
  }
}
