# Módulo AKS Monitor - Design & Especificação

## Data: 2026-05-27
## Versão alvo: v3.0.0

---

## 1. Visão Geral

Novo módulo de monitoramento de clusters **Azure Kubernetes Service (AKS)** integrado ao DBA Analyser, acessível via **Module Switcher** no header (grid de apps similar ao Google Workspace).

### Objetivos
- Monitorar aplicações (Deployments) no cluster AKS
- Visualizar status de pods, nodes, services e ingress
- Indicadores de performance: CPU, Memory, restarts, uptime
- Filtro por namespaces selecionados pelo usuário
- Autenticação dual: kubeconfig upload OU Azure Service Principal

---

## 2. Autenticação no Cluster AKS

### Opção A: Upload de Kubeconfig
- Upload do arquivo `~/.kube/config` pela UI (similar ao .ovpn da VPN)
- Suporta múltiplos contexts (múltiplos clusters)
- Backend armazena encriptado com DBA_MASTER_KEY
- Refresh automático de tokens (az login / kubelogin)

### Opção B: Azure Service Principal
- Formulário na UI: Tenant ID, Client ID, Client Secret, Subscription, Resource Group, Cluster Name
- Backend usa `@azure/identity` + `@kubernetes/client-node` para obter kubeconfig programaticamente
- Token auto-refresh via SDK

### Storage
- Tabela `k8s_clusters` com configs encriptadas
- Cada cluster tem: name, auth_method, config (encrypted), namespaces (array)

---

## 3. Indicadores & KPIs

### 3.1 Cluster Overview Dashboard
| Métrica | Source | Refresh |
|---------|--------|---------|
| Nodes total / ready / not-ready | CoreV1Api.listNode | 30s |
| Pods total / running / pending / failed | CoreV1Api.listPodForAllNamespaces | 30s |
| Deployments total / healthy / degraded | AppsV1Api.listDeploymentForAllNamespaces | 30s |
| CPU utilization % (cluster) | Metrics API (metrics-server) | 60s |
| Memory utilization % (cluster) | Metrics API (metrics-server) | 60s |
| Namespaces monitorados | Config | static |

### 3.2 Deployments (Aplicações)
| Métrica | Descrição |
|---------|-----------|
| Name | Nome do deployment |
| Namespace | Namespace onde roda |
| Status | Available ✅ / Progressing 🔄 / Degraded ❌ |
| Replicas | desired / ready / available |
| Image | Container image:tag (versão do app) |
| Last Deploy | Timestamp do último rollout |
| Restart Count | Soma de restarts de todos os pods |
| Age | Tempo desde criação |
| HPA | Se tem autoscaler: min/max/current |
| Strategy | RollingUpdate / Recreate |

### 3.3 Pods
| Métrica | Descrição |
|---------|-----------|
| Name | Nome do pod |
| Phase | Running / Pending / Succeeded / Failed / Unknown |
| Status Detail | Ready / CrashLoopBackOff / ImagePullBackOff / OOMKilled |
| Restarts | Restart count total |
| CPU Usage | mCPU atual vs limit |
| Memory Usage | Mi atual vs limit |
| Node | Em qual node está |
| Age | Tempo desde criação |
| Containers | Qtd ready/total |

### 3.4 Nodes
| Métrica | Descrição |
|---------|-----------|
| Name | Nome do node |
| Status | Ready / NotReady / conditions (MemoryPressure, DiskPressure) |
| CPU | Allocatable / Requested / Used (%) |
| Memory | Allocatable / Requested / Used (%) |
| Pods | Capacity / Allocated |
| OS | OS Image, Kernel version |
| Kubelet Version | Versão do kubelet |
| Age | Uptime do node |
| Instance Type | VM size (Standard_DS2_v2, etc) |

### 3.5 Services & Ingress (URLs Públicas)
| Métrica | Descrição |
|---------|-----------|
| Name | Nome do service/ingress |
| Type | ClusterIP / NodePort / LoadBalancer |
| External IP | IP público (se LoadBalancer) |
| Ingress URL | Host rules do ingress (domínios públicos) |
| TLS | Se tem TLS configurado + validade do cert |
| Backend Pods | Quantos pods atendem |
| Ports | Portas expostas |

### 3.6 Performance & Alertas (futuro)
| Métrica | Descrição |
|---------|-----------|
| Pod restart rate | Restarts/hora (alerta se > threshold) |
| OOMKill count | Pods mortos por falta de memória |
| Pending pods | Pods que não conseguem ser schedulados |
| Failed deployments | Rollouts que falharam |
| Certificate expiry | Dias até expirar TLS |
| Node not-ready | Alerta imediato |

---

## 4. Arquitetura Backend

### Dependências
```json
{
  "@kubernetes/client-node": "^1.4.0",
  "@azure/identity": "^4.0.0"
}
```

### Estrutura de Arquivos
```
backend/src/
├── adapters/
│   └── kubernetes.adapter.ts    # K8s client wrapper
├── services/
│   └── k8s.service.ts           # Business logic, aggregations
│   └── k8s.collector.ts         # Periodic metrics collector
├── routes/
│   └── k8s.routes.ts            # REST endpoints
├── entities/
│   └── K8sCluster.entity.ts     # TypeORM entity
```

### API Endpoints
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/k8s/clusters | Lista clusters configurados |
| POST | /api/k8s/clusters | Adicionar cluster (kubeconfig ou SP) |
| PUT | /api/k8s/clusters/:id | Editar cluster |
| DELETE | /api/k8s/clusters/:id | Remover cluster |
| POST | /api/k8s/clusters/:id/test | Testar conexão |
| GET | /api/k8s/clusters/:id/namespaces | Listar namespaces |
| PUT | /api/k8s/clusters/:id/namespaces | Salvar namespaces monitorados |
| GET | /api/k8s/overview | Dashboard overview (aggregated) |
| GET | /api/k8s/deployments?cluster=X&ns=Y | Listar deployments |
| GET | /api/k8s/pods?cluster=X&ns=Y | Listar pods |
| GET | /api/k8s/nodes?cluster=X | Listar nodes |
| GET | /api/k8s/services?cluster=X&ns=Y | Listar services |
| GET | /api/k8s/ingress?cluster=X&ns=Y | Listar ingress |
| GET | /api/k8s/metrics/pods?cluster=X&ns=Y | Métricas CPU/Mem pods |
| GET | /api/k8s/metrics/nodes?cluster=X | Métricas CPU/Mem nodes |

### Adapter K8s (kubernetes.adapter.ts)
```typescript
import * as k8s from '@kubernetes/client-node';

export class KubernetesAdapter {
  private kc: k8s.KubeConfig;
  private coreApi: k8s.CoreV1Api;
  private appsApi: k8s.AppsV1Api;
  private networkApi: k8s.NetworkingV1Api;
  private metricsApi: k8s.Metrics;

  constructor(kubeconfig: string) {
    this.kc = new k8s.KubeConfig();
    this.kc.loadFromString(kubeconfig);
    this.coreApi = this.kc.makeApiClient(k8s.CoreV1Api);
    this.appsApi = this.kc.makeApiClient(k8s.AppsV1Api);
    this.networkApi = this.kc.makeApiClient(k8s.NetworkingV1Api);
    this.metricsApi = new k8s.Metrics(this.kc);
  }

  async listNamespaces() { ... }
  async listDeployments(namespace?: string) { ... }
  async listPods(namespace?: string) { ... }
  async listNodes() { ... }
  async listServices(namespace?: string) { ... }
  async listIngress(namespace?: string) { ... }
  async getNodeMetrics() { ... }
  async getPodMetrics(namespace?: string) { ... }
}
```

---

## 5. Arquitetura Frontend

### Module Switcher
- Ícone grid (⊞) no Header, entre o LanguageSelector e o NotificationBell
- Popup com cards tipo Google Apps:
  - **DBA Analyser** (ícone Database, azul) — módulo atual
  - **DevOps Monitor** (ícone Container/Cloud, roxo) — módulo novo
- State global: `activeModule: 'dba' | 'devops'` (Zustand store)
- Sidebar muda itens baseado no módulo ativo

### Sidebar - Módulo DevOps
| Rota | Ícone | Label |
|------|-------|-------|
| /k8s | LayoutDashboard | Dashboard |
| /k8s/clusters | Server | Clusters |
| /k8s/deployments | Rocket | Deployments |
| /k8s/pods | Box | Pods |
| /k8s/nodes | Cpu | Nodes |
| /k8s/services | Globe | Services |
| /k8s/ingress | ExternalLink | Ingress |

### Páginas
1. **K8s Dashboard** — Cards overview: nodes, pods, deployments, CPU/Memory charts
2. **Clusters** — Lista de clusters AKS configurados (similar Connections page)
3. **Deployments** — Tabela com status, replicas, imagem, last deploy, restarts
4. **Pods** — Tabela com phase, restarts, CPU/Mem, node, age
5. **Nodes** — Cards com gauges CPU/Mem, conditions, pods alocados
6. **Services** — Tabela com type, external IP, ports
7. **Ingress** — Tabela com URLs públicas, TLS status, backends

### Features (permissões)
- `k8s.view` — visualizar tudo
- `k8s.manage` — adicionar/editar/remover clusters
- `k8s.pods.logs` — ver logs de pods (futuro)

---

## 6. Namespace Filter

- Na config do cluster, o usuário seleciona quais namespaces monitorar
- UI de seleção: lista todos os namespaces do cluster, checkboxes para selecionar
- APIs filtram apenas pelos namespaces selecionados
- Header mostra badge com namespace ativo (filtro rápido)

---

## 7. Cronograma Estimado

| Fase | Esforço |
|------|---------|
| Backend (adapter + routes + entity) | ~4-6h |
| Frontend (switcher + 7 páginas) | ~6-8h |
| Integração + testes | ~2h |
| **Total** | **~12-16h** |

---

## 8. Stack Técnica

- **Backend**: @kubernetes/client-node v1.4.0, @azure/identity
- **Frontend**: React + TypeScript + Tailwind (mesmo stack)
- **Ícones**: lucide-react (Rocket, Box, Cpu, Globe, Cloud, Container)
- **Charts**: recharts (CPU/Memory gauges, timeseries)
- **Real-time**: WebSocket para push de status changes (opcional fase 2)
