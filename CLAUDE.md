# CLAUDE.md - DBA Analyser

## Visão Geral
Ferramenta de monitoramento e administração de bancos de dados (SQL Server, PostgreSQL) com VPN integrada, análise de saúde, queries, alertas e AI Advisor.

## Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + Zustand
- **Backend**: Node.js + Express + TypeScript + TypeORM
- **Banco interno**: PostgreSQL 16
- **VPN**: OpenVPN Client (container sidecar)
- **Deploy**: Docker Compose

## Estrutura do Projeto
```
dba_analyser/
├── frontend/          # React app
│   ├── src/
│   │   ├── pages/         # 20+ páginas
│   │   ├── components/    # Componentes reutilizáveis
│   │   ├── i18n/          # Internacionalização (PT/EN/ES)
│   │   ├── styles/        # CSS modular (buttons, badges, cards)
│   │   └── lib/           # API client, utils
│   ├── tailwind.config.ts # Design tokens (CSS variables)
│   └── Dockerfile.dev
├── backend/           # Express API
│   ├── src/
│   │   ├── routes/        # REST endpoints
│   │   ├── adapters/      # MSSQL, PostgreSQL adapters
│   │   ├── services/      # VPN, PDF, Health collector
│   │   ├── entities/      # TypeORM entities
│   │   └── config/        # DB, encryption
│   └── Dockerfile.dev
├── docker-compose.yml
└── demandas/          # Changelog por versão
```

## Comandos Essenciais
```bash
# Subir ambiente completo
sudo docker compose up -d

# Rebuild frontend (após mudanças em package.json)
sudo docker compose build --no-cache frontend && sudo docker compose up -d frontend

# Rebuild backend
sudo docker compose build --no-cache backend && sudo docker compose up -d backend

# Restart apenas um serviço
sudo docker compose restart backend|frontend|vpn

# Logs
sudo docker compose logs -f backend --tail=50

# Build local do frontend (verificar erros)
cd frontend && npx vite build
```

## Arquitetura Docker
- **vpn**: OpenVPN client, expõe porta 3030 (backend)
- **backend**: `network_mode: "service:vpn"` — todo tráfego sai pela VPN
- **frontend**: Porta 5173, proxy `/api/*` → backend via Vite config
- **postgres**: Banco interno, porta 5433 externa

### Volumes montados
- `backend/src` → hot-reload do código
- `frontend/src` → hot-reload do código
- Docker socket → backend gerencia container VPN
- `vpn-data` → configs OpenVPN persistentes

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
- **PostgreSQL**: dba_app / dba_secret (banco: dba_analyser)
- **Master Key** (encriptação): DBA_MASTER_KEY env var

## Problemas Conhecidos
- Credenciais de conexão SQL Server encriptadas com master key diferente da atual
  - Solução: recriar conexões pela UI ou restaurar a chave original
- VPN healthcheck usa `ping 10.0.0.18` (depende do servidor destino estar acessível)

## Histórico de Versões
- **v1.8.1** (2026-05-27): Fixes VPN, Docker socket, backend deps, UI polish
- **v1.8.0** (2026-05-26): i18n (PT/EN/ES), CSS Variables design system, SearchableSelect
- **v1.7.0**: Alert history filter, UI melhorias

## Screenshots
- `docs/screenshots/dashboard-dark.png` — Dashboard (dark mode)
- `docs/screenshots/dashboard-light.png` — Dashboard (light mode)
- `docs/screenshots/connections-dark.png` — Conexões
- `docs/screenshots/query-dropdown.png` — Query com dropdown aberto
- `docs/screenshots/monitor.png` — Monitor
