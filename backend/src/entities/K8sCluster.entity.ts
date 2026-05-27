import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * K8sCluster Entity — Security-hardened
 * 
 * All sensitive fields use AES-256-GCM encryption with:
 * - Per-field unique salt (16 bytes random)
 * - Per-field unique IV (12 bytes random)  
 * - PBKDF2 key derivation (100k iterations, SHA-512)
 * - Authenticated encryption (GCM auth tag prevents tampering)
 * - Key versioning for rotation support
 */
@Entity('k8s_clusters')
export class K8sCluster {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 30, default: 'kubeconfig' })
  authMethod!: 'kubeconfig' | 'service_principal';

  // ═══════════════════════════════════════════════
  // ENCRYPTED FIELDS — kubeconfig
  // ═══════════════════════════════════════════════
  @Column({ type: 'text', nullable: true })
  configEncrypted!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  configSalt!: string | null;

  // ═══════════════════════════════════════════════
  // ENCRYPTED FIELDS — Azure Service Principal
  // ═══════════════════════════════════════════════
  @Column({ type: 'text', nullable: true })
  tenantIdEncrypted!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  tenantIdSalt!: string | null;

  @Column({ type: 'text', nullable: true })
  clientIdEncrypted!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  clientIdSalt!: string | null;

  @Column({ type: 'text', nullable: true })
  clientSecretEncrypted!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  clientSecretSalt!: string | null;

  // Non-sensitive SP fields (not secrets, just identifiers)
  @Column({ type: 'varchar', length: 100, nullable: true })
  subscriptionId!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  resourceGroup!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  clusterName!: string | null;

  // ═══════════════════════════════════════════════
  // SECURITY METADATA
  // ═══════════════════════════════════════════════
  
  /** Encryption key version — incremented on key rotation */
  @Column({ type: 'int', default: 1 })
  keyVersion!: number;

  /** SHA-256 fingerprint of the credential (for change detection without decryption) */
  @Column({ type: 'varchar', length: 64, nullable: true })
  credentialFingerprint!: string | null;

  /** Last time credentials were rotated/updated */
  @Column({ type: 'timestamp', nullable: true })
  lastRotatedAt!: Date | null;

  /** Number of times credentials were accessed (decrypted) for monitoring */
  @Column({ type: 'int', default: 0 })
  accessCount!: number;

  /** Last time credentials were accessed */
  @Column({ type: 'timestamp', nullable: true })
  lastAccessedAt!: Date | null;

  /** User who created/last modified this cluster config */
  @Column({ type: 'varchar', length: 100, nullable: true })
  createdBy!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lastModifiedBy!: string | null;

  // ═══════════════════════════════════════════════
  // OPERATIONAL
  // ═══════════════════════════════════════════════
  
  /** Namespaces to monitor (JSON array) */
  @Column({ type: 'text', default: '[]' })
  namespaces!: string;

  @Column({ type: 'varchar', nullable: true })
  serverUrl!: string | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  /** Connection timeout in ms */
  @Column({ type: 'int', default: 10000 })
  connectionTimeoutMs!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // ═══════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════

  getNamespaces(): string[] {
    try { return JSON.parse(this.namespaces); } catch { return []; }
  }

  setNamespaces(ns: string[]) {
    this.namespaces = JSON.stringify(ns);
  }

  /** Check if credentials are older than N days */
  isCredentialStale(maxAgeDays: number = 90): boolean {
    if (!this.lastRotatedAt) return true;
    const age = Date.now() - new Date(this.lastRotatedAt).getTime();
    return age > maxAgeDays * 86400000;
  }

  /** Increment access counter */
  trackAccess() {
    this.accessCount++;
    this.lastAccessedAt = new Date();
  }
}
