# CLAUDE.md - DBA Analyser

## Visão Geral
Plataforma web completa para DBAs e DevOps que centraliza monitoramento de bancos de dados (SQL Server, PostgreSQL, MySQL), comparação de schemas, monitoramento de clusters Kubernetes (AKS), e gestão operacional com VPN integrada.

## Stack Tecnológica

### Frontend
| Tecnologia | Versão | Uso |
|------------|--------|-----|
| React | 18 | Framework UI |
| TypeScript | 5.x | Tipagem estática |
| Vite | 5.4 | Build tool + HMR |
| Tailwind CSS | 3.x | Styling (CSS Variables + tokens semânticos) |
| Zustand | 4.x | State management |
| Lucide React | — | Ícones |
| i18next | — | Internacionalização (PT/EN/ES) |
| Axios | — | HTTP client |
| Socket.IO Client | — | Real-time |

### Backend
| Tecnologia | Versão | Uso |
|------------|--------|-----|
| Node.js | 22 | Runtime |
| Express | 4.x | HTTP framework |
| TypeScript | 5.x | Tipagem |
| TypeORM | 0.3.x | ORM + migrations |
| Socket.IO | 4.x | WebSocket |
| @kubernetes/client-node | 1.4.0 | K8s API client |
| mssql | — | SQL Server adapter |
| pg | — | PostgreSQL adapter |
| mysql2 | — | MySQL adapter |
| jsonwebtoken | — | JWT auth |
| crypto (native) | — | AES-256-GCM encryption |

### Infraestrutura
| Componente | Tecnologia | Detalhes |
|------------|-----------|----------|
| Container Runtime | Docker 29.5.2 | + Compose v5.1.4 |
| VPN | OpenVPN Client | Container sidecar (dperson/openvpn-client) |
| DB Interno | PostgreSQL 16 Alpine | Dados da aplicação |
| Servidor | AWS EC2 (t3.large) | Ubuntu 22.04, us-east-1 |
| CI/CD | GitHub | Branch: main |

## Estrutura do Projeto
```
dba_analyser/
├── frontend/                  # React SPA (37 páginas)
│   ├── src/
│   │   ├── pages/             # Páginas da aplicação
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── ConnectionsPage.tsx
│   │   │   ├── ExplorerPage.tsx
│   │   │   ├── QueryPage.tsx
│   │   │   ├── ComparePage.tsx         # Schema diff (LCS + word-level highlight)
│   │   │   ├── MonitorPage.tsx
│   │   │   ├── HealthPage.tsx
│   │   │   ├── AlertsPage.tsx
│   │   │   ├── VPNPage.tsx
│   │   │   ├── K8sDashboardPage.tsx    # Kubernetes module
│   │   │   ├── K8sClustersPage.tsx
│   │   │   ├── K8sDeploymentsPage.tsx
│   │   │   ├── K8sPodsPage.tsx
│   │   │   ├── K8sNodesPage.tsx
│   │   │   ├── K8sServicesPage.tsx
│   │   │   ├── K8sIngressPage.tsx
│   │   │   ├── GrowthPage.tsx
│   │   │   ├── DiagnosticsPage.tsx
│   │   │   ├── ERDiagramPage.tsx
│   │   │   ├── ExecutionPage.tsx
│   │   │   ├── BackupPage.tsx
│   │   │   ├── ReportsPage.tsx
│   │   │   ├── AuditPage.tsx
│   │   │   ├── UsersPage.tsx
│   │   │   ├── ProfilesPage.tsx
│   │   │   ├── FeaturesPage.tsx
│   │   │   ├── SettingsPage.tsx
│   │   │   └── ... (37 total)
│   │   ├── components/        # Componentes reutilizáveis
│   │   │   ├── ui/            # SearchableSelect, ModuleSwitcher, etc.
│   │   │   └── wizard/        # Wizards multi-step
│   │   ├── i18n/              # Internacionalização
│   │   │   └── locales/       # pt.json, en.json, es.json
│   │   ├── styles/            # CSS modular
│   │   └── lib/               # API client, utils
│   ├── tailwind.config.ts     # Design tokens
│   ├── vite.config.ts         # Proxy /api → backend
│   ├── Dockerfile.dev         # Dev (vite --host)
│   └── Dockerfile             # Prod (nginx)
├── backend/                   # API REST + WebSocket
│   ├── src/
│   │   ├── routes/            # 27 módulos de rotas
│   │   │   ├── auth.routes.ts
│   │   │   ├── connections.routes.ts
│   │   │   ├── explorer.routes.ts
│   │   │   ├── query.routes.ts
│   │   │   ├── compare.routes.ts
│   │   │   ├── monitor.routes.ts
│   │   │   ├── health.routes.ts
│   │   │   ├── alerts.routes.ts
│   │   │   ├── vpn.routes.ts
│   │   │   ├── k8s.routes.ts          # Rate limited + audit
│   │   │   ├── growth.routes.ts
│   │   │   ├── backup.routes.ts
│   │   │   ├── execution.routes.ts
│   │   │   ├── diagnostics.routes.ts
│   │   │   ├── reports.routes.ts
│   │   │   ├── reports-pdf.routes.ts
│   │   │   ├── audit.routes.ts
│   │   │   ├── users.routes.ts
│   │   │   ├── profiles.routes.ts
│   │   │   ├── features.routes.ts
│   │   │   ├── notifications.routes.ts
│   │   │   ├── clients.routes.ts
│   │   │   ├── heartbeat.routes.ts
│   │   │   ├── advisor.routes.ts
│   │   │   ├── schema-version.routes.ts
│   │   │   ├── two-factor.routes.ts
│   │   │   └── swagger-docs.ts
│   │   ├── adapters/          # Conectores de banco
│   │   │   ├── base.adapter.ts
│   │   │   ├── adapter.factory.ts
│   │   │   ├── mssql.adapter.ts
│   │   │   ├── postgres.adapter.ts
│   │   │   ├── mysql.adapter.ts
│   │   │   └── kubernetes.adapter.ts  # READ-ONLY mode
│   │   ├── services/          # Lógica de negócio
│   │   │   ├── k8s.service.ts         # AES-256-GCM encryption
│   │   │   ├── vpn.service.ts
│   │   │   ├── health-collector.ts
│   │   │   ├── alert-scheduler.ts
│   │   │   └── pdf.service.ts
│   │   ├── entities/          # TypeORM (22 entidades)
│   │   ├── middleware/        # Auth, RBAC, feature-check
│   │   └── config/            # DB, encryption, swagger
│   ├── Dockerfile.dev
│   └── Dockerfile
├── docker-compose.yml         # Ambiente de desenvolvimento
├── docker-compose.prod.yml    # Produção
├── .env                       # Variáveis (não commitado)
├── .env.example
├── CLAUDE.md                  # Este arquivo
├── README.md                  # Documentação pública
├── SPRINT.md                  # Planejamento
└── demandas/                  # Specs por feature/versão
    ├── AKS-MONITOR.md
    ├── k8s-readonly-rbac.yaml
    └── ...
```

## Arquitetura Docker

### Containers (docker-compose.yml)
```
┌─────────────────────────────────────────────────────────┐
│                    Docker Network                         │
│                                                          │
│  ┌──────────┐    ┌──────────────────────────────────┐   │
│  │ postgres │    │         vpn container             │   │
│  │  :5432   │    │  ┌─────────────────────────────┐  │   │
│  │          │    │  │    backend (network_mode:    │  │   │
│  │          │◄───┤  │      service:vpn)            │  │   │
│  └──────────┘    │  │       :3030                  │  │   │
│                  │  └─────────────────────────────┘  │   │
│                  │         OpenVPN tun0               │   │
│                  │         → 10.0.0.18 (SQL Server)   │   │
│                  │         :3030 (exposed)            │   │
│                  └──────────────────────────────────┘   │
│                                                          │
│  ┌──────────────┐                                       │
│  │   frontend   │  Vite dev server                      │
│  │    :5173     │  Proxy: /api → vpn:3030               │
│  └──────────────┘                                       │
└─────────────────────────────────────────────────────────┘
```

### Detalhes dos Containers
| Container | Imagem | Porta | Função |
|-----------|--------|-------|--------|
| **vpn** | dperson/openvpn-client | 3030 (backend) | Túnel OpenVPN, expõe porta do backend |
| **backend** | node:22-alpine (custom) | — (usa rede do vpn) | API REST, network_mode: service:vpn |
| **frontend** | node:22-alpine (custom) | 5173 | Vite dev com HMR |
| **postgres** | postgres:16-alpine | 5433→5432 | Banco interno da aplicação |

### Networking Crítico
- **Backend usa `network_mode: "service:vpn"`** — compartilha namespace de rede com o container VPN
- Todo tráfego do backend (incluindo queries SQL Server) sai pela interface tun0
- O backend NÃO tem IP próprio — a porta 3030 é exposta pelo container VPN
- Frontend faz proxy de `/api/*` para `http://172.18.0.1:3030` (IP do host no Docker bridge)

### Volumes
| Volume | Mount | Descrição |
|--------|-------|-----------|
| pgdata | postgres:/var/lib/postgresql/data | Dados persistentes PostgreSQL |
| vpn-data | vpn:/vpn, backend:/vpn | Configs OpenVPN (.ovpn, auth.txt) |
| ./backend/src | backend:/app/src | Hot-reload dev |
| ./frontend/src | frontend:/app/src | Hot-reload dev (HMR) |
| /var/run/docker.sock | backend:/var/run/docker.sock | Gerenciamento VPN container |

## Comandos Essenciais
```bash
# ══════════════════════════════════════════════════
# GERENCIAMENTO DE CONTAINERS
# ══════════════════════════════════════════════════

# Subir ambiente completo
sudo docker compose up -d

# Status dos containers
sudo docker compose ps

# Rebuild e restart (após mudanças em package.json ou Dockerfile)
sudo docker compose build --no-cache frontend backend
sudo docker compose up -d

# Restart individual
sudo docker compose restart frontend
sudo docker compose restart backend  # Nota: restarta pelo vpn container

# Logs em tempo real
sudo docker compose logs -f backend --tail=50
sudo docker compose logs -f vpn --tail=20
sudo docker compose logs -f frontend --tail=20

# Derrubar tudo
sudo docker compose down

# Derrubar + limpar volumes (CUIDADO: apaga dados)
sudo docker compose down -v

# ══════════════════════════════════════════════════
# BUILD & VERIFICAÇÃO
# ══════════════════════════════════════════════════

# Build local do frontend (verificar erros TypeScript)
cd frontend && npx vite build

# TypeScript check (sem gerar output)
cd frontend && npx tsc --noEmit --skipLibCheck

# Backend TypeScript check
cd backend && npx tsc --noEmit

# ══════════════════════════════════════════════════
# VPN
# ══════════════════════════════════════════════════

# Ver se VPN está conectada
sudo docker exec dba_analyser-vpn-1 ip addr show tun0

# Testar conectividade com SQL Server
sudo docker exec dba_analyser-backend-1 ping -c 3 10.0.0.18

# Restart VPN (via Docker)
sudo docker restart dba_analyser-vpn-1

# Ver logs VPN
sudo docker logs dba_analyser-vpn-1 --tail=30

# ══════════════════════════════════════════════════
# GIT
# ══════════════════════════════════════════════════

# Status
git status

# Commit + Push
git add -A && git commit -m "desc" && git push origin main

# Log
git log --oneline -10
```

## Módulos da Aplicação

### 🔌 Módulo DBA (Principal)
| Página | Funcionalidade |
|--------|---------------|
| Dashboard | Overview geral, widgets de saúde e alertas |
| Connections | CRUD de conexões (MSSQL, PostgreSQL, MySQL) |
| Explorer | Catálogo visual de objetos do banco |
| Query | IDE SQL com autocomplete e execução |
| Compare | **Diff de schema com LCS + word-level highlighting** |
| Monitor | Sessões ativas, locks, queries em execução |
| Health | Coletores de métricas + indicadores |
| Alerts | Sistema de alertas configuráveis |
| Growth | Crescimento de tabelas + projeções |
| Diagnostics | Análise de performance |
| ER Diagram | Diagrama entidade-relacionamento |
| Execution | Deploy controlado multi-banco |
| Backup | Jobs de backup + monitoramento |
| Reports | Relatórios + export PDF |
| VPN | Gerenciamento OpenVPN (upload, connect, restart) |
| Advisor | AI Query advisor |
| Heartbeat | Monitoramento de disponibilidade |
| MTTR | Métricas de tempo de recuperação |

### ☸️ Módulo Kubernetes (DevOps)
| Página | Funcionalidade |
|--------|---------------|
| K8s Dashboard | Overview dos clusters |
| K8s Clusters | CRUD de clusters (credenciais encriptadas AES-256-GCM) |
| K8s Deployments | Lista deployments com réplicas |
| K8s Pods | Pods expandíveis com status de containers |
| K8s Nodes | Grid de cards com barras CPU/Memory |
| K8s Services | Tabela de services com type badges |
| K8s Ingress | Visualização de rules + TLS badges |

### 🔐 Módulo Administração
| Página | Funcionalidade |
|--------|---------------|
| Users | CRUD de usuários |
| Profiles | Perfis de acesso (Admin, DBA, Operador, Viewer) |
| Features | 35+ feature flags |
| Audit | Log de auditoria completo |
| Clients | Multi-tenancy |
| Settings | Configurações do sistema |
| Notifications | Canais de notificação |

## Segurança

### Autenticação
- JWT com access + refresh tokens
- 2FA (TOTP) disponível
- Password hashing com bcrypt

### Autorização (RBAC)
- Feature-based access control (35 features)
- Middleware: `requireFeature('feature.name')`
- 4 perfis pré-definidos: Administrador, DBA, Operador, Viewer

### Criptografia (K8s Credentials)
- **Algoritmo**: AES-256-GCM
- **Derivação de chave**: PBKDF2 com 100.000 iterações SHA-512
- **Salt**: 16 bytes únicos POR CAMPO (não compartilhado)
- **IV**: 12 bytes aleatórios por operação
- **Campos encriptados**: tenantId, clientId, clientSecret, kubeconfig
- **Fingerprint**: SHA-256 do conteúdo para detecção de mudanças sem descriptografar
- **API nunca retorna secrets**: Apenas `hasClientSecret: true` + partial fingerprint

### Rate Limiting (K8s)
- Endpoints sensíveis (credentials): 10 req/min por IP
- Endpoints de leitura: 60 req/min por IP
- In-memory per-IP tracking

### Kubernetes READ-ONLY
- Adapter tem ZERO métodos de escrita
- `testConnection()` verifica SelfSubjectAccessReview e ALERTA se write access detectado
- RBAC YAML fornecido (`demandas/k8s-readonly-rbac.yaml`) com apenas get/list/watch

## Schema Comparator (v2.6.0)

### Algoritmo de Diff
- **Alinhamento**: LCS (Longest Common Subsequence) para arquivos até 2000 linhas
- **Highlighting**: Word-level diff com tokenização (palavras, símbolos, espaços)
- **Navegação**: Setas ↑↓ para saltar entre diferenças
- **Filtro**: "Só diferenças" mostra linhas alteradas + 3 linhas de contexto
- **Fullscreen**: Modo tela cheia para objetos grandes (600+ linhas)

### Normalização SQL (eliminação de falsos positivos)
1. Remove `SET ANSI_NULLS ON/OFF`
2. Remove `SET QUOTED_IDENTIFIER ON/OFF`  
3. Remove prefixo `dbo.`
4. Normaliza `CREATE PROCEDURE` / `CREATE PROC` → formato consistente
5. Remove trailing whitespace
6. Remove blank lines extras
7. Normaliza espaços ao redor de parênteses
8. Normaliza espaços ao redor de vírgulas
9. Normaliza `CREATE OR ALTER` → `CREATE`
10. Normaliza `ALTER PROCEDURE` → `CREATE PROCEDURE`
11. Remove comentários SQL inline (`-- ...`)
12. Normaliza múltiplos espaços → single space
13. Trim geral

### Filtro Active-Only
- **Triggers**: Exclui `is_disabled = 1`
- **Procedures/Functions/Views**: Exclui objetos com `definition IS NULL` ou `is_ms_shipped = 1`

### Normalização de Defaults
- `((0))` → `0`
- `(getdate())` → `getdate()`
- Strips nested SQL Server parentheses

### Normalização de Tipos
- Trim + lowercase para comparação
- `nvarchar (50)` = `nvarchar(50)`

### Index Ordering
- Usa `ORDER BY key_ordinal` para consistência na comparação de colunas de índice

## VPN - Gerenciamento Remoto

### Endpoints
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/vpn/status | Status (connected, ip, configUploaded) |
| POST | /api/vpn/upload | Upload de .ovpn + credenciais |
| POST | /api/vpn/connect | Restart container VPN |
| POST | /api/vpn/disconnect | Stop container VPN |
| POST | /api/vpn/restart | Stop + Start container VPN |
| DELETE | /api/vpn/config | Remove configuração .ovpn |
| GET | /api/vpn/logs | Logs do container VPN |

### Botão Restart (Header)
- Ícone: ↺ (RotateCcw) cor amarela
- Chama `POST /api/vpn/restart`
- Backend executa `docker stop` + `docker start` via Docker socket
- Requer permissão `vpn.manage`

## Design System

### CSS Variables
- Dark/Light mode via classe `.dark` no `<html>`
- Tokens semânticos: `bg-surface`, `bg-surface-elevated`, `text-text-primary`, `border-border`
- Classes modulares: `.btn-primary`, `.badge-success`, `.card-hover`

### Module Switcher
- Popup tipo Google Apps grid no Header
- Alterna entre módulos DBA e DevOps (K8s)
- Ícone: grid 3x3

## Credenciais

### Aplicação
| Recurso | Usuário | Senha |
|---------|---------|-------|
| App (admin) | admin | Dba@2025!Secure |
| PostgreSQL | dba_app | dba_secret |
| DB name | dba_analyser | — |
| PostgreSQL port | 5433 | — |

### Variáveis de Ambiente (.env)
```bash
DBA_MASTER_KEY=<gerado com openssl rand -hex 32>
JWT_SECRET=<gerado com openssl rand -hex 32>
```

### SQL Server (via VPN)
| Campo | Valor |
|-------|-------|
| Host | 10.0.0.18 |
| Port | 1433 |
| User | SDP_USER_KLEYTON.MIRANDA |
| DB Type | mssql |
| Connection ID | 1280ed7d-2596-46eb-9fe4-97554c2b73bb |

## Ambiente de Desenvolvimento

### Servidor
| Item | Valor |
|------|-------|
| IP Público | 54.235.49.22 |
| OS | Ubuntu 22.04 |
| Instance | AWS EC2 t3.large (us-east-1) |
| Docker | v29.5.2 + Compose v5.1.4 |
| Node.js | v22.22.2 |
| Chrome | Google Chrome 148 (headless) |

### Portas Expostas
| Porta | Serviço | URL |
|-------|---------|-----|
| 5173 | Frontend (Vite) | http://54.235.49.22:5173 |
| 3030 | Backend API | http://54.235.49.22:3030 |
| 5433 | PostgreSQL | localhost:5433 |

### Git
| Item | Valor |
|------|-------|
| Remote | git@github.com:kleytonmirandabr/dba_analyser.git |
| Branch | main |
| SSH Key | ed25519 (SHA256:vWJB6g3D+uUN+C44qmfKmqQiCnQ+MLTQBN3yXCF49GI) |

## Internacionalização (i18n)
- Biblioteca: i18next + react-i18next
- Idiomas: Português (pt), English (en), Español (es)
- ~180+ chaves de tradução
- Seletor com bandeiras no Header
- Detecção automática do idioma do browser

## Histórico de Versões
| Versão | Data | Principais Features |
|--------|------|---------------------|
| v2.6.0 | 2026-05-27 | Smart diff UI (LCS + word-level + navigation + fullscreen) |
| v2.5.1 | 2026-05-27 | Schema comparator fixes (active-only, side-by-side, normalization) |
| v2.5.0 | 2026-05-27 | Módulo Kubernetes completo (7 páginas, AES-256-GCM, READ-ONLY) |
| v2.4.0 | 2026-05-27 | VPN restart button, password eye toggle |
| v2.3.0 | 2026-05-26 | i18n (PT/EN/ES), CSS Variables, SearchableSelect |
| v2.2.0 | 2026-05-26 | Alert history, SQL safety, dashboard indicators |
| v2.1.0 | 2026-05-26 | Performance, Query IDE |
| v2.0.0 | 2026-05-25 | Swagger, Help Center, 2FA, MTTR, PDF Reports |

## Problemas Conhecidos
- K8s module aguardando teste com cluster real (user precisa aplicar RBAC YAML + upload kubeconfig)
- Credenciais de conexão SQL Server encriptadas com master key — se mudar a key, recriar conexões
- Container VPN pode mostrar "connected" falsamente se detectar interface Docker como tun0

## Convenções de Código

### Backend
- TypeScript strict mode
- Express + TypeORM
- Rotas em `src/routes/`, services em `src/services/`
- Middleware auth + feature check em rotas protegidas
- `child_process` para comandos Docker (execSync/exec)
- Auditoria automática em operações sensíveis

### Frontend
- React 18 functional components (hooks only)
- Zustand para state management
- Axios com interceptors JWT
- Lucide React para ícones
- Tailwind CSS com tokens semânticos
- i18next para traduções
- Páginas em `src/pages/`, componentes em `src/components/`
- Preferência: dark theme
