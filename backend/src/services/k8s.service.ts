import * as crypto from 'crypto';
import { AppDataSource } from '../config/database';
import { K8sCluster } from '../entities/K8sCluster.entity';
import { KubernetesAdapter } from '../adapters/kubernetes.adapter';
import { encrypt, decrypt } from '../config/encryption';

const clusterRepo = () => AppDataSource.getRepository(K8sCluster);

// ═══════════════════════════════════════════════
// INPUT VALIDATION
// ═══════════════════════════════════════════════

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_KUBECONFIG_SIZE = 1024 * 1024; // 1MB max
const MAX_NAME_LENGTH = 100;
const FORBIDDEN_NAME_CHARS = /[<>'";&|$`\\]/;

interface ValidationError {
  field: string;
  message: string;
}

function validateClusterInput(data: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!data.name || data.name.length < 2) errors.push({ field: 'name', message: 'Nome deve ter pelo menos 2 caracteres' });
  if (data.name && data.name.length > MAX_NAME_LENGTH) errors.push({ field: 'name', message: `Nome máximo ${MAX_NAME_LENGTH} caracteres` });
  if (data.name && FORBIDDEN_NAME_CHARS.test(data.name)) errors.push({ field: 'name', message: 'Nome contém caracteres proibidos' });

  if (data.authMethod === 'kubeconfig') {
    if (!data.kubeconfig) errors.push({ field: 'kubeconfig', message: 'Kubeconfig é obrigatório' });
    if (data.kubeconfig && data.kubeconfig.length > MAX_KUBECONFIG_SIZE) errors.push({ field: 'kubeconfig', message: 'Kubeconfig excede 1MB' });
    // Basic YAML structure check
    if (data.kubeconfig && !data.kubeconfig.includes('apiVersion') && !data.kubeconfig.includes('clusters')) {
      errors.push({ field: 'kubeconfig', message: 'Formato de kubeconfig inválido' });
    }
  } else if (data.authMethod === 'service_principal') {
    if (!data.tenantId) errors.push({ field: 'tenantId', message: 'Tenant ID é obrigatório' });
    else if (!UUID_REGEX.test(data.tenantId)) errors.push({ field: 'tenantId', message: 'Tenant ID deve ser um UUID válido' });

    if (!data.clientId) errors.push({ field: 'clientId', message: 'Client ID é obrigatório' });
    else if (!UUID_REGEX.test(data.clientId)) errors.push({ field: 'clientId', message: 'Client ID deve ser um UUID válido' });

    if (!data.clientSecret) errors.push({ field: 'clientSecret', message: 'Client Secret é obrigatório' });
    else if (data.clientSecret.length < 8) errors.push({ field: 'clientSecret', message: 'Client Secret muito curto (min 8 chars)' });
  } else {
    errors.push({ field: 'authMethod', message: 'Método de autenticação inválido' });
  }

  return errors;
}

// ═══════════════════════════════════════════════
// SECRET MASKING — never expose secrets to frontend
// ═══════════════════════════════════════════════

function maskSecret(value: string | null): string | null {
  if (!value) return null;
  if (value.length <= 8) return '••••••••';
  return '••••••••-' + value.slice(-4);
}

function fingerprint(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
}

// ═══════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════

export class K8sService {
  private adapterCache = new Map<string, { adapter: KubernetesAdapter; expiry: number }>();
  private static ADAPTER_CACHE_TTL = 300000; // 5 min

  /**
   * List clusters — NEVER returns decrypted secrets
   */
  async listClusters() {
    const clusters = await clusterRepo().find({ order: { name: 'ASC' } });
    return clusters.map(c => ({
      id: c.id,
      name: c.name,
      authMethod: c.authMethod,
      serverUrl: c.serverUrl,
      namespaces: c.getNamespaces(),
      isActive: c.isActive,
      keyVersion: c.keyVersion,
      credentialFingerprint: c.credentialFingerprint,
      lastRotatedAt: c.lastRotatedAt,
      accessCount: c.accessCount,
      lastAccessedAt: c.lastAccessedAt,
      isCredentialStale: c.isCredentialStale(90),
      createdBy: c.createdBy,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      // MASKED secrets — for UI display only
      hasTenantId: !!c.tenantIdEncrypted,
      hasClientId: !!c.clientIdEncrypted,
      hasClientSecret: !!c.clientSecretEncrypted,
      hasKubeconfig: !!c.configEncrypted,
      // Security indicators
      encryptionAlgorithm: 'AES-256-GCM',
      keyDerivation: 'PBKDF2-SHA512-100k'
    }));
  }

  /**
   * Add cluster with full encryption + validation
   */
  async addCluster(data: {
    name: string;
    authMethod: 'kubeconfig' | 'service_principal';
    kubeconfig?: string;
    tenantId?: string;
    clientId?: string;
    clientSecret?: string;
    subscriptionId?: string;
    resourceGroup?: string;
    clusterName?: string;
    namespaces?: string[];
  }, userId?: string) {
    // VALIDATION
    const errors = validateClusterInput(data);
    if (errors.length > 0) {
      throw new ValidationException(errors);
    }

    const cluster = new K8sCluster();
    cluster.name = data.name.trim();
    cluster.authMethod = data.authMethod;
    cluster.createdBy = userId || 'system';
    cluster.lastModifiedBy = userId || 'system';
    cluster.lastRotatedAt = new Date();

    if (data.authMethod === 'kubeconfig' && data.kubeconfig) {
      const { encrypted, salt } = encrypt(data.kubeconfig);
      cluster.configEncrypted = encrypted;
      cluster.configSalt = salt;
      cluster.credentialFingerprint = fingerprint(data.kubeconfig);

      // Extract server URL from kubeconfig for display
      const serverMatch = data.kubeconfig.match(/server:\s*(.+)/);
      if (serverMatch) cluster.serverUrl = serverMatch[1].trim();

    } else if (data.authMethod === 'service_principal') {
      // Encrypt each field with its own salt
      if (data.tenantId) {
        const enc = encrypt(data.tenantId);
        cluster.tenantIdEncrypted = enc.encrypted;
        cluster.tenantIdSalt = enc.salt;
      }
      if (data.clientId) {
        const enc = encrypt(data.clientId);
        cluster.clientIdEncrypted = enc.encrypted;
        cluster.clientIdSalt = enc.salt;
      }
      if (data.clientSecret) {
        const enc = encrypt(data.clientSecret);
        cluster.clientSecretEncrypted = enc.encrypted;
        cluster.clientSecretSalt = enc.salt;
      }
      cluster.subscriptionId = data.subscriptionId || null;
      cluster.resourceGroup = data.resourceGroup || null;
      cluster.clusterName = data.clusterName || null;

      // Fingerprint from combined SP data
      cluster.credentialFingerprint = fingerprint(`${data.tenantId}:${data.clientId}`);
    }

    if (data.namespaces) cluster.setNamespaces(data.namespaces);

    const saved = await clusterRepo().save(cluster);
    return { id: saved.id, name: saved.name, message: 'Cluster adicionado com criptografia AES-256-GCM' };
  }

  /**
   * Update cluster — re-encrypts with new salt on credential change
   */
  async updateCluster(id: string, data: Partial<{
    name: string;
    kubeconfig: string;
    tenantId: string;
    clientId: string;
    clientSecret: string;
    namespaces: string[];
    isActive: boolean;
  }>, userId?: string) {
    const cluster = await clusterRepo().findOneByOrFail({ id });
    cluster.lastModifiedBy = userId || 'system';

    if (data.name) cluster.name = data.name.trim();
    if (data.namespaces) cluster.setNamespaces(data.namespaces);
    if (data.isActive !== undefined) cluster.isActive = data.isActive;

    // Re-encrypt credentials with fresh salt on update
    if (data.kubeconfig) {
      const { encrypted, salt } = encrypt(data.kubeconfig);
      cluster.configEncrypted = encrypted;
      cluster.configSalt = salt;
      cluster.credentialFingerprint = fingerprint(data.kubeconfig);
      cluster.lastRotatedAt = new Date();
      cluster.keyVersion++;
    }
    if (data.tenantId) {
      const enc = encrypt(data.tenantId);
      cluster.tenantIdEncrypted = enc.encrypted;
      cluster.tenantIdSalt = enc.salt;
    }
    if (data.clientId) {
      const enc = encrypt(data.clientId);
      cluster.clientIdEncrypted = enc.encrypted;
      cluster.clientIdSalt = enc.salt;
    }
    if (data.clientSecret) {
      const enc = encrypt(data.clientSecret);
      cluster.clientSecretEncrypted = enc.encrypted;
      cluster.clientSecretSalt = enc.salt;
      cluster.lastRotatedAt = new Date();
      cluster.keyVersion++;
    }

    // Invalidate adapter cache
    this.adapterCache.delete(id);

    return await clusterRepo().save(cluster);
  }

  async deleteCluster(id: string) {
    // Securely delete — TypeORM hard delete removes all encrypted data
    await clusterRepo().delete(id);
    this.adapterCache.delete(id);
  }

  async testConnection(id: string) {
    const adapter = await this.getAdapter(id);
    const result = await adapter.testConnection();
    return { ...result, encryption: 'AES-256-GCM', keyDerivation: 'PBKDF2-100k-SHA512' };
  }

  async getNamespaces(id: string) {
    const adapter = await this.getAdapter(id);
    return adapter.listNamespaces();
  }

  async updateNamespaces(id: string, namespaces: string[]) {
    const cluster = await clusterRepo().findOneByOrFail({ id });
    cluster.setNamespaces(namespaces);
    await clusterRepo().save(cluster);
    return { namespaces };
  }

  async getOverview(id: string) {
    const cluster = await clusterRepo().findOneByOrFail({ id });
    const adapter = await this.getAdapter(id);
    const namespaces = cluster.getNamespaces();
    if (namespaces.length === 0) {
      const allNs = await adapter.listNamespaces();
      return adapter.getOverview(allNs.filter(ns => !ns.startsWith('kube-')));
    }
    return adapter.getOverview(namespaces);
  }

  async getDeployments(id: string, namespace?: string) {
    const cluster = await clusterRepo().findOneByOrFail({ id });
    const adapter = await this.getAdapter(id);
    const namespaces = namespace ? [namespace] : cluster.getNamespaces();
    return adapter.listDeployments(namespaces.length > 0 ? namespaces : ['default']);
  }

  async getPods(id: string, namespace?: string) {
    const cluster = await clusterRepo().findOneByOrFail({ id });
    const adapter = await this.getAdapter(id);
    const namespaces = namespace ? [namespace] : cluster.getNamespaces();
    return adapter.listPods(namespaces.length > 0 ? namespaces : ['default']);
  }

  async getNodes(id: string) {
    const adapter = await this.getAdapter(id);
    return adapter.listNodes();
  }

  async getServices(id: string, namespace?: string) {
    const cluster = await clusterRepo().findOneByOrFail({ id });
    const adapter = await this.getAdapter(id);
    const namespaces = namespace ? [namespace] : cluster.getNamespaces();
    return adapter.listServices(namespaces.length > 0 ? namespaces : ['default']);
  }

  async getIngress(id: string, namespace?: string) {
    const cluster = await clusterRepo().findOneByOrFail({ id });
    const adapter = await this.getAdapter(id);
    const namespaces = namespace ? [namespace] : cluster.getNamespaces();
    return adapter.listIngress(namespaces.length > 0 ? namespaces : ['default']);
  }

  // ═══════════════════════════════════════════════
  // PRIVATE — Secure adapter instantiation
  // ═══════════════════════════════════════════════

  private async getAdapter(clusterId: string): Promise<KubernetesAdapter> {
    const cached = this.adapterCache.get(clusterId);
    if (cached && cached.expiry > Date.now()) return cached.adapter;

    const cluster = await clusterRepo().findOneByOrFail({ id: clusterId });
    
    // Track access for audit
    cluster.trackAccess();
    await clusterRepo().save(cluster);

    let kubeconfig: string;

    if (cluster.authMethod === 'kubeconfig' && cluster.configEncrypted && cluster.configSalt) {
      kubeconfig = decrypt(cluster.configEncrypted, cluster.configSalt);
    } else if (cluster.authMethod === 'service_principal') {
      // Build kubeconfig from SP credentials via Azure token exchange
      // For now, throw informative error
      throw new Error('Service Principal: implementação de token exchange pendente. Use kubeconfig por enquanto.');
    } else {
      throw new Error('Credenciais não encontradas ou corrompidas');
    }

    const adapter = new KubernetesAdapter(kubeconfig);
    this.adapterCache.set(clusterId, { adapter, expiry: Date.now() + K8sService.ADAPTER_CACHE_TTL });
    return adapter;
  }
}

// Custom validation exception
export class ValidationException extends Error {
  constructor(public errors: ValidationError[]) {
    super('Validation failed: ' + errors.map(e => e.message).join(', '));
    this.name = 'ValidationException';
  }
}

export const k8sService = new K8sService();
