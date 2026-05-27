import { AppDataSource } from '../config/database';
import { K8sCluster } from '../entities/K8sCluster.entity';
import { KubernetesAdapter } from '../adapters/kubernetes.adapter';
import { encrypt, decrypt } from '../config/encryption';

const clusterRepo = () => AppDataSource.getRepository(K8sCluster);

export class K8sService {
  private adapterCache = new Map<string, { adapter: KubernetesAdapter; expiry: number }>();

  async listClusters() {
    const clusters = await clusterRepo().find({ order: { name: 'ASC' } });
    return clusters.map(c => ({
      id: c.id,
      name: c.name,
      authMethod: c.authMethod,
      serverUrl: c.serverUrl,
      namespaces: c.getNamespaces(),
      isActive: c.isActive,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    }));
  }

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
  }) {
    const cluster = new K8sCluster();
    cluster.name = data.name;
    cluster.authMethod = data.authMethod;

    if (data.authMethod === 'kubeconfig' && data.kubeconfig) {
      cluster.configEncrypted = encrypt(data.kubeconfig);
    } else if (data.authMethod === 'service_principal') {
      cluster.tenantId = data.tenantId ? encrypt(data.tenantId) : null;
      cluster.clientId = data.clientId ? encrypt(data.clientId) : null;
      cluster.clientSecret = data.clientSecret ? encrypt(data.clientSecret) : null;
      cluster.subscriptionId = data.subscriptionId || null;
      cluster.resourceGroup = data.resourceGroup || null;
      cluster.clusterName = data.clusterName || null;
    }

    if (data.namespaces) cluster.setNamespaces(data.namespaces);
    
    return await clusterRepo().save(cluster);
  }

  async updateCluster(id: string, data: Partial<{
    name: string;
    kubeconfig: string;
    namespaces: string[];
    isActive: boolean;
  }>) {
    const cluster = await clusterRepo().findOneByOrFail({ id });
    if (data.name) cluster.name = data.name;
    if (data.kubeconfig) cluster.configEncrypted = encrypt(data.kubeconfig);
    if (data.namespaces) cluster.setNamespaces(data.namespaces);
    if (data.isActive !== undefined) cluster.isActive = data.isActive;
    return await clusterRepo().save(cluster);
  }

  async deleteCluster(id: string) {
    await clusterRepo().delete(id);
  }

  async testConnection(id: string) {
    const adapter = await this.getAdapter(id);
    return adapter.testConnection();
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
      // If no namespaces selected, get all
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

  // --- Private ---

  private async getAdapter(clusterId: string): Promise<KubernetesAdapter> {
    // Cache adapter for 5 minutes
    const cached = this.adapterCache.get(clusterId);
    if (cached && cached.expiry > Date.now()) return cached.adapter;

    const cluster = await clusterRepo().findOneByOrFail({ id: clusterId });
    let kubeconfig: string;

    if (cluster.authMethod === 'kubeconfig' && cluster.configEncrypted) {
      kubeconfig = decrypt(cluster.configEncrypted);
    } else {
      throw new Error('Service Principal auth not yet implemented. Use kubeconfig.');
    }

    const adapter = new KubernetesAdapter(kubeconfig);
    this.adapterCache.set(clusterId, { adapter, expiry: Date.now() + 300000 });
    return adapter;
  }
}

export const k8sService = new K8sService();
