import * as k8s from '@kubernetes/client-node';

export interface K8sDeployment {
  name: string;
  namespace: string;
  replicas: { desired: number; ready: number; available: number; updated: number };
  image: string;
  status: 'healthy' | 'progressing' | 'degraded';
  strategy: string;
  age: string;
  createdAt: string;
  restartCount: number;
  conditions: { type: string; status: string; message?: string }[];
}

export interface K8sPod {
  name: string;
  namespace: string;
  phase: string;
  statusDetail: string;
  restarts: number;
  node: string;
  ip: string;
  age: string;
  createdAt: string;
  containers: { name: string; ready: boolean; image: string; restarts: number }[];
  cpu?: { usage: number; limit: number };
  memory?: { usage: number; limit: number };
}

export interface K8sNode {
  name: string;
  status: string;
  conditions: { type: string; status: string }[];
  cpu: { allocatable: number; capacity: number };
  memory: { allocatable: number; capacity: number };
  pods: { allocatable: number; count: number };
  kubeletVersion: string;
  osImage: string;
  kernelVersion: string;
  containerRuntime: string;
  instanceType: string;
  age: string;
  createdAt: string;
}

export interface K8sService {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  externalIP: string | null;
  ports: { port: number; targetPort: number | string; protocol: string; name?: string }[];
  selector: Record<string, string>;
  age: string;
}

export interface K8sIngress {
  name: string;
  namespace: string;
  hosts: string[];
  tls: boolean;
  tlsHosts: string[];
  rules: { host: string; paths: { path: string; service: string; port: number }[] }[];
  loadBalancerIP: string | null;
  age: string;
}

export interface K8sOverview {
  nodes: { total: number; ready: number; notReady: number };
  pods: { total: number; running: number; pending: number; failed: number; succeeded: number };
  deployments: { total: number; healthy: number; progressing: number; degraded: number };
  services: { total: number; loadBalancers: number };
  ingresses: number;
  cpu?: { used: number; allocatable: number; percent: number };
  memory?: { used: number; allocatable: number; percent: number };
}

/**
 * KubernetesAdapter — READ-ONLY by design
 * 
 * This adapter intentionally exposes ONLY read operations (get, list, watch).
 * No create, update, delete, or patch methods are implemented.
 * The app is designed to MONITOR, not MANAGE infrastructure.
 * 
 * Recommended: use a ClusterRole with only ["get", "list", "watch"] verbs.
 * See: demandas/k8s-readonly-rbac.yaml
 */
export class KubernetesAdapter {
  private kc: k8s.KubeConfig;
  private coreApi: k8s.CoreV1Api;
  private appsApi: k8s.AppsV1Api;
  private networkApi: k8s.NetworkingV1Api;
  private metricsClient: k8s.Metrics;

  // READ-ONLY MODE: This adapter has zero write capabilities
  public readonly accessMode = 'READ_ONLY' as const;

  constructor(kubeconfig: string) {
    this.kc = new k8s.KubeConfig();
    this.kc.loadFromString(kubeconfig);
    this.coreApi = this.kc.makeApiClient(k8s.CoreV1Api);
    this.appsApi = this.kc.makeApiClient(k8s.AppsV1Api);
    this.networkApi = this.kc.makeApiClient(k8s.NetworkingV1Api);
    this.metricsClient = new k8s.Metrics(this.kc);
  }

  async testConnection(): Promise<{ ok: boolean; version?: string; accessMode?: string; permissions?: string[]; error?: string }> {
    try {
      const versionApi = this.kc.makeApiClient(k8s.VersionApi);
      const { body } = await versionApi.getCode();

      // Verify read-only access with a SelfSubjectAccessReview
      let permissions: string[] = ['get', 'list', 'watch'];
      try {
        const authApi = this.kc.makeApiClient(k8s.AuthorizationV1Api);
        // Check if we accidentally have write access (warn user)
        const writeCheck = await authApi.createSelfSubjectAccessReview({
          apiVersion: 'authorization.k8s.io/v1',
          kind: 'SelfSubjectAccessReview',
          spec: { resourceAttributes: { verb: 'create', resource: 'pods', namespace: 'default' } }
        });
        if (writeCheck.body.status?.allowed) {
          permissions.push('⚠️ WRITE ACCESS DETECTED — recomendado usar ServiceAccount read-only');
        }
      } catch {} // If can't check, proceed anyway

      return { ok: true, version: `Kubernetes ${body.gitVersion}`, accessMode: 'READ_ONLY', permissions };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Connection failed' };
    }
  }

  async listNamespaces(): Promise<string[]> {
    const { body } = await this.coreApi.listNamespace();
    return body.items.map(ns => ns.metadata?.name || '').filter(Boolean);
  }

  async listDeployments(namespaces: string[]): Promise<K8sDeployment[]> {
    const results: K8sDeployment[] = [];
    for (const ns of namespaces) {
      const { body } = await this.appsApi.listNamespacedDeployment(ns);
      for (const dep of body.items) {
        const spec = dep.spec!;
        const status = dep.status!;
        const containers = spec.template.spec?.containers || [];
        const image = containers.map(c => c.image).join(', ');
        
        // Determine deployment status
        let depStatus: 'healthy' | 'progressing' | 'degraded' = 'healthy';
        if ((status.readyReplicas || 0) < (spec.replicas || 1)) {
          depStatus = (status.updatedReplicas || 0) < (spec.replicas || 1) ? 'progressing' : 'degraded';
        }
        if ((status.unavailableReplicas || 0) > 0) depStatus = 'degraded';

        results.push({
          name: dep.metadata?.name || '',
          namespace: ns,
          replicas: {
            desired: spec.replicas || 0,
            ready: status.readyReplicas || 0,
            available: status.availableReplicas || 0,
            updated: status.updatedReplicas || 0
          },
          image,
          status: depStatus,
          strategy: spec.strategy?.type || 'RollingUpdate',
          age: this.getAge(dep.metadata?.creationTimestamp),
          createdAt: dep.metadata?.creationTimestamp?.toISOString() || '',
          restartCount: 0, // Will be enriched from pods
          conditions: (status.conditions || []).map(c => ({
            type: c.type, status: c.status, message: c.message
          }))
        });
      }
    }
    return results;
  }

  async listPods(namespaces: string[]): Promise<K8sPod[]> {
    const results: K8sPod[] = [];
    for (const ns of namespaces) {
      const { body } = await this.coreApi.listNamespacedPod(ns);
      for (const pod of body.items) {
        const status = pod.status!;
        const containerStatuses = status.containerStatuses || [];
        const totalRestarts = containerStatuses.reduce((sum, c) => sum + (c.restartCount || 0), 0);
        
        // Determine detailed status
        let statusDetail = status.phase || 'Unknown';
        for (const cs of containerStatuses) {
          if (cs.state?.waiting?.reason) {
            statusDetail = cs.state.waiting.reason; // CrashLoopBackOff, ImagePullBackOff, etc.
            break;
          }
          if (cs.state?.terminated?.reason) {
            statusDetail = cs.state.terminated.reason; // OOMKilled, Error, etc.
            break;
          }
        }

        results.push({
          name: pod.metadata?.name || '',
          namespace: ns,
          phase: status.phase || 'Unknown',
          statusDetail,
          restarts: totalRestarts,
          node: pod.spec?.nodeName || '',
          ip: status.podIP || '',
          age: this.getAge(pod.metadata?.creationTimestamp),
          createdAt: pod.metadata?.creationTimestamp?.toISOString() || '',
          containers: containerStatuses.map(c => ({
            name: c.name,
            ready: c.ready,
            image: c.image,
            restarts: c.restartCount
          }))
        });
      }
    }
    return results;
  }

  async listNodes(): Promise<K8sNode[]> {
    const { body } = await this.coreApi.listNode();
    return body.items.map(node => {
      const status = node.status!;
      const conditions = status.conditions || [];
      const readyCondition = conditions.find(c => c.type === 'Ready');
      const nodeStatus = readyCondition?.status === 'True' ? 'Ready' : 'NotReady';

      const allocatable = status.allocatable || {};
      const capacity = status.capacity || {};

      return {
        name: node.metadata?.name || '',
        status: nodeStatus,
        conditions: conditions.map(c => ({ type: c.type!, status: c.status! })),
        cpu: {
          allocatable: this.parseCpu(allocatable['cpu']),
          capacity: this.parseCpu(capacity['cpu'])
        },
        memory: {
          allocatable: this.parseMemory(allocatable['memory']),
          capacity: this.parseMemory(capacity['memory'])
        },
        pods: {
          allocatable: parseInt(allocatable['pods'] || '110'),
          count: 0 // Will be enriched
        },
        kubeletVersion: status.nodeInfo?.kubeletVersion || '',
        osImage: status.nodeInfo?.osImage || '',
        kernelVersion: status.nodeInfo?.kernelVersion || '',
        containerRuntime: status.nodeInfo?.containerRuntimeVersion || '',
        instanceType: node.metadata?.labels?.['node.kubernetes.io/instance-type'] || node.metadata?.labels?.['beta.kubernetes.io/instance-type'] || '',
        age: this.getAge(node.metadata?.creationTimestamp),
        createdAt: node.metadata?.creationTimestamp?.toISOString() || ''
      };
    });
  }

  async listServices(namespaces: string[]): Promise<K8sService[]> {
    const results: K8sService[] = [];
    for (const ns of namespaces) {
      const { body } = await this.coreApi.listNamespacedService(ns);
      for (const svc of body.items) {
        const spec = svc.spec!;
        const lbIngress = svc.status?.loadBalancer?.ingress || [];
        const externalIP = lbIngress.length > 0 ? (lbIngress[0].ip || lbIngress[0].hostname || null) : null;

        results.push({
          name: svc.metadata?.name || '',
          namespace: ns,
          type: spec.type || 'ClusterIP',
          clusterIP: spec.clusterIP || '',
          externalIP,
          ports: (spec.ports || []).map(p => ({
            port: p.port,
            targetPort: p.targetPort as any,
            protocol: p.protocol || 'TCP',
            name: p.name
          })),
          selector: spec.selector || {},
          age: this.getAge(svc.metadata?.creationTimestamp)
        });
      }
    }
    return results;
  }

  async listIngress(namespaces: string[]): Promise<K8sIngress[]> {
    const results: K8sIngress[] = [];
    for (const ns of namespaces) {
      try {
        const { body } = await this.networkApi.listNamespacedIngress(ns);
        for (const ing of body.items) {
          const spec = ing.spec!;
          const lbIngress = ing.status?.loadBalancer?.ingress || [];
          const lbIP = lbIngress.length > 0 ? (lbIngress[0].ip || lbIngress[0].hostname || null) : null;

          results.push({
            name: ing.metadata?.name || '',
            namespace: ns,
            hosts: (spec.rules || []).map(r => r.host || '*'),
            tls: !!(spec.tls && spec.tls.length > 0),
            tlsHosts: (spec.tls || []).flatMap(t => t.hosts || []),
            rules: (spec.rules || []).map(r => ({
              host: r.host || '*',
              paths: (r.http?.paths || []).map(p => ({
                path: p.path || '/',
                service: p.backend.service?.name || '',
                port: p.backend.service?.port?.number || 0
              }))
            })),
            loadBalancerIP: lbIP,
            age: this.getAge(ing.metadata?.creationTimestamp)
          });
        }
      } catch {} // Ingress might not exist in some namespaces
    }
    return results;
  }

  async getOverview(namespaces: string[]): Promise<K8sOverview> {
    const [nodes, deployments, pods, services, ingresses] = await Promise.all([
      this.listNodes(),
      this.listDeployments(namespaces),
      this.listPods(namespaces),
      this.listServices(namespaces),
      this.listIngress(namespaces)
    ]);

    // Try to get metrics
    let cpu: K8sOverview['cpu'];
    let memory: K8sOverview['memory'];
    try {
      const nodeMetrics = await this.metricsClient.getNodeMetrics();
      const totalCpuUsed = nodeMetrics.items.reduce((sum, n) => sum + this.parseCpu(n.usage.cpu), 0);
      const totalMemUsed = nodeMetrics.items.reduce((sum, n) => sum + this.parseMemory(n.usage.memory), 0);
      const totalCpuAlloc = nodes.reduce((sum, n) => sum + n.cpu.allocatable, 0);
      const totalMemAlloc = nodes.reduce((sum, n) => sum + n.memory.allocatable, 0);
      cpu = { used: totalCpuUsed, allocatable: totalCpuAlloc, percent: totalCpuAlloc > 0 ? Math.round((totalCpuUsed / totalCpuAlloc) * 100) : 0 };
      memory = { used: totalMemUsed, allocatable: totalMemAlloc, percent: totalMemAlloc > 0 ? Math.round((totalMemUsed / totalMemAlloc) * 100) : 0 };
    } catch {} // Metrics server might not be available

    return {
      nodes: {
        total: nodes.length,
        ready: nodes.filter(n => n.status === 'Ready').length,
        notReady: nodes.filter(n => n.status !== 'Ready').length
      },
      pods: {
        total: pods.length,
        running: pods.filter(p => p.phase === 'Running').length,
        pending: pods.filter(p => p.phase === 'Pending').length,
        failed: pods.filter(p => p.phase === 'Failed').length,
        succeeded: pods.filter(p => p.phase === 'Succeeded').length
      },
      deployments: {
        total: deployments.length,
        healthy: deployments.filter(d => d.status === 'healthy').length,
        progressing: deployments.filter(d => d.status === 'progressing').length,
        degraded: deployments.filter(d => d.status === 'degraded').length
      },
      services: {
        total: services.length,
        loadBalancers: services.filter(s => s.type === 'LoadBalancer').length
      },
      ingresses: ingresses.length,
      cpu,
      memory
    };
  }

  // --- Helpers ---

  private getAge(date?: Date): string {
    if (!date) return '';
    const ms = Date.now() - new Date(date).getTime();
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    if (days > 0) return `${days}d${hours}h`;
    if (hours > 0) return `${hours}h${mins}m`;
    return `${mins}m`;
  }

  private parseCpu(value: string | undefined): number {
    if (!value) return 0;
    if (value.endsWith('m')) return parseInt(value) / 1000;
    if (value.endsWith('n')) return parseInt(value) / 1000000000;
    return parseFloat(value);
  }

  private parseMemory(value: string | undefined): number {
    if (!value) return 0;
    const units: Record<string, number> = { Ki: 1024, Mi: 1048576, Gi: 1073741824, Ti: 1099511627776 };
    for (const [suffix, multiplier] of Object.entries(units)) {
      if (value.endsWith(suffix)) return parseInt(value) * multiplier;
    }
    return parseInt(value);
  }
}
