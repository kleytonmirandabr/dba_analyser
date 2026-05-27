# CLAUDE.md - DBA Analyser

## Visão Geral
Ferramenta de monitoramento e administração de bancos de dados (SQL Server, PostgreSQL) com VPN integrada, análise de saúde, queries, alertas e AI Advisor.

## Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + Zustand
- **Backend**: Node.js + Express + TypeScript + TypeORM
- **Banco interno**: PostgreSQL 16
- **VPN**: OpenVPN Client (container sidecar com restart remoto via UI)
- **Deploy**: Docker Compose

## Estrutura do Projeto
```
dba_analyser/
├── frontend/          # React app
│   ├── src/
│   │   ├── pages/         # 20+ páginas (VPNPage, QueryPage, HealthPage, etc.)
│   │   ├── components/    # Componentes reutilizáveis + wizard/
│   │   ├── i18n/          # Internacionalização (PT/EN/ES)
│   │   ├── styles/        # CSS modular (buttons, badges, cards)
│   │   └── lib/           # API client (axios), utils
│   ├── tailwind.config.ts # Design tokens (CSS variables)
│   ├── vite.config.ts     # Proxy: /api → backend:3030
│   ├── Dockerfile         # Produção (nginx)
│   └── Dockerfile.dev     # Dev (vite --host)
├── backend/           # Express API
│   ├── src/
│   │   ├── routes/        # REST endpoints (auth, vpn, query, etc.)
│   │   ├── adapters/      # MSSQL, PostgreSQL adapters
│   │   ├── services/      # VPN, PDF, Health collector, Alert scheduler
│   │   ├── entities/      # TypeORM entities
│   │   ├── middleware/    # auth, feature-based access control
│   │   └── config/        # DB, encryption, swagger
│   ├── Dockerfile         # Produção
│   └── Dockerfile.dev     # Dev (ts-node-dev, root user, docker-cli)
├── docker-compose.yml     # Dev environment (4 serviços)
├── docker-compose.prod.yml
├── .env                   # Variáveis locais (não commitado)
├── .env.example
└── demandas/          # Changelog por versão
```

## Comandos Essenciais
```bash
# Subir ambiente completo (sem VPN)
sudo docker compose up -d

# Subir com VPN
sudo docker compose up -d  # VPN container sempre sobe, mas só conecta com .ovpn

# Rebuild frontend (após mudanças em package.json)
sudo docker compose build --no-cache frontend && sudo docker compose up -d frontend

# Rebuild backend (após mudanças em Dockerfile ou package.json)
sudo docker compose build --no-cache backend && sudo docker compose up -d backend

# Restart apenas um serviço
sudo docker compose restart backend|frontend|vpn

# Logs
sudo docker compose logs -f backend --tail=50
sudo docker compose logs -f vpn --tail=50

# Status dos containers
sudo docker compose ps

# Derrubar tudo
sudo docker compose down

# Build local do frontend (verificar erros)
cd frontend && npx vite build
```

## Arquitetura Docker

### Containers (docker-compose.yml)
| Container | Imagem | Porta | Observações |
|-----------|--------|-------|-------------|
| **vpn** | dperson/openvpn-client | — | Sidecar OpenVPN, needs .ovpn in /vpn volume |
| **backend** | node:22-alpine (custom) | 3030 | Roda como root para acesso ao docker socket |
| **frontend** | node:22-alpine (custom) | 5173 | Vite dev server com proxy para backend |
| **postgres** | postgres:16-alpine | 5433→5432 | Banco interno do sistema |

### Notas importantes
- **Backend NÃO usa network_mode: service:vpn** (modo dev) — roda em rede própria para estabilidade
- Backend tem acesso ao **Docker socket** (`/var/run/docker.sock`) para gerenciar container VPN via API
- Container names são fixos: `dba_analyser-vpn-1`, `dba_analyser-backend-1`, etc.
- Frontend proxy: `/api/*` → `http://backend:3030` (via vite.config.ts)
- VPN volume compartilhado: backend lê configs VPN para status

### Volumes montados
- `./backend/src` → hot-reload do código
- `./frontend/src` → hot-reload do código
- `/var/run/docker.sock` → backend gerencia container VPN
- `vpn-data` → configs OpenVPN persistentes (.ovpn, auth.txt)
- `pgdata` → dados PostgreSQL

## VPN - Gerenciamento Remoto

### Endpoints VPN
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/vpn/status | Status da VPN (connected, ip, configUploaded) |
| POST | /api/vpn/upload | Upload de .ovpn + credenciais |
| POST | /api/vpn/connect | Reinicia container VPN (docker restart) |
| POST | /api/vpn/disconnect | Para container VPN (docker stop) |
| POST | /api/vpn/restart | Stop + Start do container VPN |
| DELETE | /api/vpn/config | Remove configuração .ovpn |
| GET | /api/vpn/logs | Logs do container VPN (últimas N linhas) |

### Fluxo VPN pela UI
1. Acesse página VPN no menu lateral
2. Faça upload do arquivo `.ovpn` (e credenciais se necessário)
3. Clique "Salvar e Conectar" — backend salva no volume e reinicia container
4. Acompanhe progresso nos logs em tempo real (painel lateral)
5. Botão **"Reiniciar"** (amarelo) — restart remoto do container sem SSH

### Botão Reiniciar
- Ícone: ↺ (RotateCcw) cor amarela
- Chama `POST /api/vpn/restart`
- Backend executa `docker stop` + `docker start` via docker socket
- Requer permissão `vpn.manage`

## Design System (v1.8.0+)
- CSS Variables em `src/index.css` (:root para light, .dark para dark)
- Tailwind tokens semânticos: `bg-surface`, `bg-surface-elevated`, `text-text-primary`, `border-border`
- Classes CSS modulares: `.btn-primary`, `.badge-success`, `.card-hover`
- Dark/Light mode via classe `.dark` no `<html>`

## Internacionalização (i18n)
- Lib: i18next + react-i18next
- Locales: `src/i18n/locales/pt.json`, `en.json`, `es.json` (~180 keys)
- Seletor de idioma com bandeiras no Header
- Detecção automática do idioma do browser

## Credenciais
- **App**: admin / Dba@2025!Secure
- **PostgreSQL**: dba_app / dba_secret (banco: dba_analyser, porta: 5433)
- **Master Key** (encriptação): gerada com `openssl rand -hex 32` no .env
- **JWT Secret**: gerada com `openssl rand -hex 32` no .env

## Permissões (Feature-based)
Sistema de controle de acesso por features:
- 35 features registradas (dashboard.view, connections.manage, vpn.manage, etc.)
- Profiles: Administrador, DBA, Operador, Viewer
- Middleware: `requireFeature('vpn.manage')` em rotas protegidas

## Ambiente de Desenvolvimento (SkyKoi Server)

### Servidor
- **IP**: 54.235.49.22 (EC2 AWS us-east-1)
- **OS**: Ubuntu 22.04
- **Docker**: v29.5.2, Compose v5.1.4
- **Node**: v22.22.2
- **Chrome**: Google Chrome 148 (headless, para automação/testes)

### Portas expostas
| Porta | Serviço |
|-------|---------|
| 5173 | Frontend (Vite dev) |
| 3030 | Backend API |
| 5433 | PostgreSQL |

### SSH Key (GitHub deploy)
- Tipo: ed25519
- Email: kleytonmiranda@gmail.com
- Localização: `/home/ubuntu/.ssh/id_ed25519`
- Fingerprint: SHA256:vWJB6g3D+uUN+C44qmfKmqQiCnQ+MLTQBN3yXCF49GI

### Git
- Remote: git@github.com:kleytonmirandabr/dba_analyser.git
- Branch: main

## Problemas Conhecidos
- Credenciais de conexão SQL Server encriptadas com master key diferente da atual
  - Solução: recriar conexões pela UI ou restaurar a chave original
- VPN healthcheck depende de interface tun0 e ping para 10.0.0.18
  - Sem .ovpn, container VPN roda mas mostra "VPN not configured"
- Container VPN pode mostrar "connected" falsamente se detectar interface de rede Docker como tun0
  - Fix pendente: melhorar lógica do healthcheck

## Histórico de Versões
- **v2.5.0** (atual): 20+ páginas, i18n, design system, VPN remote restart, feature-based permissions
- **v1.8.1** (2026-05-27): Fixes VPN, Docker socket, backend deps, UI polish
- **v1.8.0** (2026-05-26): i18n (PT/EN/ES), CSS Variables design system, SearchableSelect
- **v1.7.0**: Alert history filter, SQL safety, dashboard indicators
- **v1.6.0**: Performance, Query IDE

## Convenções de Código

### Backend
- TypeScript strict
- Express + TypeORM
- Rotas em `src/routes/`, services em `src/services/`
- Middleware auth + feature check em todas as rotas protegidas
- Imports: `child_process` para docker commands (execSync/exec)

### Frontend
- React 18 functional components
- Zustand para state management
- Axios para API calls (interceptors com token JWT)
- Lucide React para ícones
- TailwindCSS com tokens semânticos
- i18next para traduções
- Páginas em `src/pages/`, componentes em `src/components/`
