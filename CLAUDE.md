# CLAUDE.md — Guia de contexto para o agente

Este arquivo é lido no início de cada sessão de trabalho. Contém tudo que o agente precisa saber para operar no projeto DBA Analyser.

---

## 1. Projeto

**DBA Analyser** — Ferramenta web self-hosted para análise, comparação e monitoramento de bancos de dados.
- **Dono:** Kleyton Miranda (`kleytonmiranda@gmail.com`)
- **Idioma de trabalho:** Português (Brasil)
- **Repositório:** `https://github.com/kleytonmirandabr/dba_analyser`
- **URL de produção:** TBD (self-hosted via Docker Compose)

**Stack:** Node.js + Express + TypeScript (backend) | React + Vite + TypeScript + Tailwind + shadcn/ui (frontend) | PostgreSQL 16 (DB interno) | Socket.io (real-time) | Docker Compose (deploy)

---

## 2. Restrições de Ambiente

### 🐳 100% Dockerizado — Nada no Host

O DBA Analyser é **completamente containerizado**. Na máquina host só precisa de Docker + Docker Compose instalados. Nenhum Node.js, npm, PostgreSQL, ou qualquer outra dependência no host.

| Container | Imagem | Função |
|-----------|--------|--------|
| `vpn` | dperson/openvpn-client | Túnel OpenVPN para rede dos clientes |
| `backend` | Node.js 22 (custom build) | API REST + WebSocket (network_mode: service:vpn) |
| `frontend` | Node.js (dev) / Nginx (prod) | Interface web React |
| `postgres` | postgres:16-alpine | Banco INTERNO do sistema (usuários, conexões, audit) |

**Os bancos dos clientes NÃO estão no Docker** — eles estão na rede remota do cliente, acessíveis pelo túnel VPN. O DBA Analyser apenas conecta neles para consultar/monitorar/comparar.

```bash
# Requisitos da máquina host:
# - Docker Engine 24+
# - Docker Compose v2+
# - /dev/net/tun disponível (padrão em Linux)
# - Nada mais.

docker compose up --build   # Sobe TUDO
```

---

### ⚠️ VPN Obrigatória
- Os bancos de dados alvos (que o DBA Analyser conecta) estão atrás de VPN
- A VPN roda APENAS na máquina do Kleyton
- O servidor Koi (cloud) NÃO consegue acessar os bancos diretamente
- **Consequência:** Todo o ambiente de execução precisa ser Docker Compose rodando na máquina do Kleyton (ou em um servidor com acesso à VPN)
- **Desenvolvimento:** O agente escreve código e commita no Git. Kleyton faz `git pull && docker compose up` na máquina com VPN

### Modelo de Trabalho
```
[Agente Koi] → escreve código → git push
[Kleyton]    → git pull → docker compose up → acessa via browser localhost
```

- O agente NUNCA tenta conectar em bancos de dados externos
- O agente NUNCA tenta fazer deploy remoto (sem SSH para a máquina do Kleyton)
- Todo o trabalho do agente é: escrever código + commitar + documentar

---



### OpenVPN Integrado (Container Sidecar)

O sistema usa um container OpenVPN como sidecar. O backend roteia TODO tráfego de banco de dados através do túnel VPN.

**Arquitetura:**
```
┌─────────────────── Docker Compose ───────────────────────┐
│                                                          │
│  ┌──────────┐     ┌──────────────────────────────────┐   │
│  │ Frontend │     │  network_mode: "service:vpn"     │   │
│  │ :80/:5173│     │  ┌──────────┐    ┌───────────┐   │   │
│  └────┬─────┘     │  │ Backend  │    │  OpenVPN  │   │   │
│       │           │  │ :3030    │    │  Client   │───┼──▶ Rede do Cliente
│       └───────────┼─▶│          │    │           │   │   │ (bancos de dados)
│                   │  └──────────┘    └───────────┘   │   │
│                   └──────────────────────────────────┘   │
│                                                          │
│  ┌──────────┐                                            │
│  │ Postgres │ (DB interno - NÃO precisa de VPN)          │
│  │ :5433    │                                            │
│  └──────────┘                                            │
└──────────────────────────────────────────────────────────┘
```

**Fluxo de configuração (Wizard na UI):**
1. Upload do arquivo `.ovpn` via interface
2. Informar usuário e senha da VPN (se necessário)
3. Sistema armazena criptografado (AES-256) no volume `vpn-data`
4. Backend reinicia o container VPN com a nova config
5. Status exibido no dashboard: "VPN Conectada ✅" / "Desconectada ❌"
6. Só depois de VPN ativa → cadastrar conexões de banco

**Imagens Docker usadas:**
- `dperson/openvpn-client` — container leve que roda OpenVPN client
- Alternativa: `ghcr.io/wfg/openvpn-client` (mais mantido)

**Requisitos do host:**
- `/dev/net/tun` disponível (padrão em Linux)
- Docker com `cap_add: NET_ADMIN` permitido

**Reconexão automática:**
- OpenVPN já faz reconnect nativo (`persist-tun`, `persist-key`)
- Healthcheck no container verifica conectividade a cada 30s
- Se VPN cai, backend retorna erro "VPN desconectada" nas chamadas de banco

---

### Modelo de Trabalho (atualizado com VPN)

**Cenário 1: Servidor Koi (cloud) com VPN**
```
[Agente Koi] → escreve código → git push
[Servidor]   → docker compose up → VPN conecta → bancos acessíveis
```

**Cenário 2: Máquina local do Kleyton**
```
[Agente Koi] → escreve código → git push
[Kleyton]    → git pull → docker compose up → VPN conecta → bancos acessíveis
```

Em ambos os cenários, a VPN roda DENTRO do Docker — não precisa de VPN no host.

---

## 3. Como fazer deploy

### 3.1 Ambiente de desenvolvimento (máquina do Kleyton)

```bash
# Clone
git clone git@github.com:kleytonmirandabr/dba_analyser.git
cd dba_analyser

# Subir tudo
docker compose up --build

# Frontend: http://localhost:5173 (dev com hot reload)
# Backend:  http://localhost:3030
# Postgres interno: localhost:5433
```

### 3.2 Ambiente de produção (mesma máquina ou servidor com VPN)

```bash
docker compose -f docker-compose.prod.yml up -d --build
# Acesso: http://localhost (porta 80)
```

### 3.3 Atualizar

```bash
cd dba_analyser
git pull origin main
docker compose up --build -d
```

---

## 4. Estrutura do Repositório

```
dba_analyser/
├── frontend/                    # React + Vite + TS + Tailwind + shadcn
│   ├── Dockerfile
│   ├── Dockerfile.dev
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── lib/                 # utils, api client
│       ├── stores/              # Zustand stores
│       ├── components/          # Componentes reutilizáveis
│       │   ├── ui/              # shadcn/ui
│       │   └── layout/          # AppLayout, Sidebar, Header
│       └── pages/               # Páginas por rota
│
├── backend/                     # Node.js + Express + TS + TypeORM
│   ├── Dockerfile
│   ├── Dockerfile.dev
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts             # Bootstrap Express + Socket.io
│       ├── config/              # DB config, encryption config
│       ├── middleware/          # auth, permission, audit
│       ├── entities/            # TypeORM entities
│       ├── adapters/            # Multi-DB adapters (pg, mssql, mysql)
│       ├── services/            # Business logic
│       ├── routes/              # Express routes
│       └── websocket/           # Socket.io handlers
│
├── docker-compose.yml           # Dev (com hot reload)
├── docker-compose.prod.yml      # Produção (build + nginx)
├── .env.example                 # Template de variáveis
├── CLAUDE.md                    # Este arquivo
├── SPRINT.md                    # Planejamento de sprints
├── ANALISE.md                   # Análise completa (DBA/Dev/Req/Arq)
└── README.md
```

---

## 5. Docker Compose (Dev)

```yaml
# docker-compose.yml (desenvolvimento com hot reload)
services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    ports:
      - "5173:5173"
    volumes:
      - ./frontend/src:/app/src
      - ./frontend/public:/app/public
    environment:
      - VITE_API_URL=http://localhost:3030
    depends_on:
      - backend

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    ports:
      - "3030:3030"
    volumes:
      - ./backend/src:/app/src
    environment:
      - DATABASE_URL=postgresql://dba_app:dba_secret@postgres:5432/dba_analyser
      - DBA_MASTER_KEY=${DBA_MASTER_KEY:-dev-master-key-change-in-prod}
      - JWT_SECRET=${JWT_SECRET:-dev-jwt-secret-change-in-prod}
      - NODE_ENV=development
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: dba_analyser
      POSTGRES_USER: dba_app
      POSTGRES_PASSWORD: dba_secret
    ports:
      - "5433:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dba_app -d dba_analyser"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  pgdata:
```

---

## 6. Docker Compose (Produção)

```yaml
# docker-compose.prod.yml
services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      - backend

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "3030:3030"
    environment:
      - DATABASE_URL=postgresql://dba_app:${DB_PASSWORD}@postgres:5432/dba_analyser
      - DBA_MASTER_KEY=${DBA_MASTER_KEY}
      - JWT_SECRET=${JWT_SECRET}
      - NODE_ENV=production
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: dba_analyser
      POSTGRES_USER: dba_app
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dba_app -d dba_analyser"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

---

## 7. Convenções de Código

### Geral
- **Idioma do código:** Inglês (variáveis, funções, classes, comments técnicos)
- **Idioma da UI:** Português (Brasil) com suporte a i18n futuro
- **Tamanho de arquivo:** Máximo 300 linhas — decompor se ultrapassar
- **Commits:** Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`

### Backend (Node.js + Express + TypeScript)
- Express com middleware pattern (auth → permission → audit → handler)
- TypeORM com `dataSource.query(sql, params)` retorna array diretamente
- Todas queries parametrizadas (NUNCA concatenar strings SQL)
- Services não conhecem Express (recebem dados puros, retornam dados puros)
- Routes são finas: validam input (Zod), chamam service, formatam response
- Responses sempre: `{ data, error?, meta? }`
- Credenciais NUNCA aparecem em logs, responses, ou error messages
- Erros tipados com código e mensagem

### Frontend (React + TypeScript)
- Zustand para state management
- Componentes < 150 linhas idealmente
- Pages importam components, não têm lógica pesada
- API calls via `lib/api.ts` (Axios com interceptors de auth)
- Tailwind + shadcn/ui para todos os componentes visuais
- Dark mode obrigatório (todas as telas)

### SQL
- Todas queries via adapters — nunca SQL direto nos routes/services
- Parametrização obrigatória (`$1, $2` para PG, `@param` para MSSQL)
- Nenhum `DROP DATABASE` ou `TRUNCATE` executável sem double-confirm

---

## 8. Regras de Segurança (INVIOLÁVEIS)

1. **Credenciais armazenadas com AES-256-GCM** — salt único por conexão
2. **Master key em variável de ambiente** — nunca hardcoded, nunca commitada
3. **API NUNCA retorna senhas** — nem criptografadas, nem mascaradas parcialmente
4. **Permissão do sistema > GRANT do banco** — se o sistema diz READ_ONLY, não executa DDL/DML mesmo que o user do banco seja superuser
5. **Toda execução precisa de aprovação** (exceto modo auto-approve para DEV)
6. **Audit log é append-only** — sem UPDATE/DELETE na aplicação
7. **SQL injection impossível** — 100% parametrizado, validado com Zod
8. **Timeout em TODA conexão externa** — default 30s, configurável
9. **Credenciais descriptografadas just-in-time** — não ficam em memória entre requests
10. **Rate limiting** em todas as rotas de auth

---

## 9. Modelo de Permissões

### Roles de Usuário
| Role | Pode consultar | Pode solicitar execução | Pode aprovar | Pode configurar |
|------|---|---|---|---|
| VIEWER | ✅ | ❌ | ❌ | ❌ |
| DBA | ✅ | ✅ | ❌ | ❌ |
| ADMIN | ✅ | ✅ | ✅ | ✅ |

### Modos de Conexão
| Modo | SELECT | ALTER/CREATE | DROP | Approval |
|------|---|---|---|---|
| READ_ONLY | ✅ | ❌ | ❌ | N/A |
| EXECUTE | ✅ | ✅ | ⚠️ (whitelist) | Obrigatório (exceto DEV auto-approve) |

### Workflow de Execução
```
Solicitar → [Pendente] → Aprovar → [Aprovado] → Executar → [Concluído/Falhou]
                       → Rejeitar → [Rejeitado]
```

---

## 10. Variáveis de Ambiente

```bash
# .env.example
DATABASE_URL=postgresql://dba_app:senha@postgres:5432/dba_analyser
DBA_MASTER_KEY=gerar-chave-aleatoria-256-bits
JWT_SECRET=gerar-secret-aleatorio
DB_PASSWORD=senha-do-postgres-interno

# Opcionais
NODE_ENV=production
PORT=3030
LOG_LEVEL=info
ALERT_EMAIL_SMTP=smtp://...
ALERT_WEBHOOK_URL=https://...
```

---

## 11. Troubleshooting

### "Connection refused" ao conectar em banco externo
- Verificar se a VPN está ativa na máquina
- O Docker precisa usar `network_mode: host` OU o host do banco deve ser acessível pela rede Docker
- Para acessar serviços na máquina host de dentro do container: usar `host.docker.internal` (Mac/Windows) ou `172.17.0.1` (Linux)

### TypeORM migrations
```bash
# Gerar migration
docker compose exec backend npx typeorm migration:generate -d src/config/database.ts src/migrations/NomeDaMigration

# Rodar migrations
docker compose exec backend npx typeorm migration:run -d src/config/database.ts
```

### Reset do banco interno
```bash
docker compose down -v  # Remove volume do postgres
docker compose up --build
```

---

## 12. Referências

| Recurso | URL |
|---------|-----|
| pg-diff (inspiração) | https://github.com/michaelsogos/pg-diff |
| PostgresCompare (UX ref) | https://www.postgrescompare.com/ |
| shadcn/ui | https://ui.shadcn.com/ |
| TypeORM docs | https://typeorm.io/ |
| Socket.io docs | https://socket.io/docs/ |
| Monaco Editor (SQL) | https://github.com/suren-atoyan/monaco-react |


---

## Changelog (Controle de Versão)

### v0.1.0 — Fundação (2026-05-25)
**Commits:** `f76761e` → `a5db2d1` (9 commits)

| Versão | Commit | Descrição |
|--------|--------|-----------|
| 0.0.1 | f76761e | Docs iniciais (README, SPRINT, CLAUDE, ANALISE) |
| 0.0.2 | 602c9ad | Arquitetura OpenVPN sidecar + docker-compose |
| 0.1.0 | 1d8b70c | Monorepo completo (backend + frontend + Docker) |
| 0.1.1 | 42e63b0 | TypeORM entities + Auth JWT + Seed |
| 0.1.2 | bbe02eb | Connection CRUD + AES-256 + PG adapter + VPN service |
| 0.1.3 | a5db2d1 | Frontend funcional (Login, Conexões, VPN Wizard) |

### Arquitetura de Pastas (v0.1.3)
```
dba_analyser/
├── backend/
│   ├── src/
│   │   ├── adapters/         # Database adapters (PG, MSSQL, MySQL)
│   │   ├── config/           # database.ts, encryption.ts
│   │   ├── entities/         # TypeORM entities
│   │   ├── middleware/       # auth, audit
│   │   ├── routes/           # auth, connections, vpn
│   │   ├── seeds/            # Admin default
│   │   ├── services/         # vpn.service
│   │   └── index.ts          # Entry point
│   ├── Dockerfile / Dockerfile.dev
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/       # layout/, wizard/
│   │   ├── lib/              # api.ts, utils.ts
│   │   ├── pages/            # Dashboard, Connections, Login
│   │   ├── stores/           # auth.store (Zustand)
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── Dockerfile / Dockerfile.dev
│   └── package.json
├── demandas/                  # Controle de entregas
├── docker-compose.yml         # Dev environment
├── docker-compose.prod.yml    # Production
├── CLAUDE.md                  # Contexto para AI
├── SPRINT.md                  # Planejamento 4 semanas
└── README.md
```

### v0.2.0 — Explorer + Monitor (2026-05-25)
**Commits:** `da98db3` → `7ac18d8` (3 commits)

| Versão | Commit | Descrição |
|--------|--------|-----------|
| 0.2.0 | 7ac18d8 | Explorer (tree view) + Monitor (queries, locks, kill, stats) |
| 0.1.4 | da98db3 | Fix TypeORM entity column types |
| 0.1.3a | 6848d80 | Docs: demandas/ + changelog |

### v0.3.0 — SQL Editor + Execution + Comparador + Audit (2026-05-25)
**Commits:** `0bc237b` → (current)

| Versão | Commit | Descrição |
|--------|--------|-----------|
| 0.3.0 | (current) | SQL Editor, Execution Workflow, Comparador, Audit Log, Dashboard real |
| 0.2.1 | 0bc237b | Backend routes (query, execution, compare) |

### Funcionalidades completas (v0.3.0)
1. **Dashboard** — Stats reais, quick actions
2. **Conexões** — CRUD + test + VPN Wizard
3. **Explorer** — Tree (schema → table → columns/PK/FK)
4. **Query** — SQL Editor, Ctrl+Enter, CSV export, histórico
5. **Monitor** — Queries ativas, locks, kill, stats
6. **Execuções** — Workflow submit → approve → execute
7. **Comparador** — Diff entre 2 DBs (tables, views, functions)
8. **Audit Log** — Todas ações logadas, filtros, CSV export

### v0.5.1 — VPN Auto-Connect via Docker Socket (2026-05-25)
**Commits:** latest

| Versão | Commit | Descrição |
|--------|--------|-----------|
| 0.5.1 | (current) | Backend controla VPN container via Docker socket, botão Cancelar + timeout |

### v0.5.0 — VPN UX + Deploy fixes (2026-05-25)
**Commits:** `ca9609a` → (current)

| Versão | Commit | Descrição |
|--------|--------|-----------|
| 0.5.0 | (current) | VPN page completa, auto-connect, progress indicator, docker-compose.dev |
| 0.4.1 | - | Fix frontend proxy (Vite), docker-compose.dev.yml sem VPN |
| 0.4.0 | ca9609a | MSSQL + MySQL adapters, WebSocket monitor, Settings page |

### Funcionalidades completas (v0.4.0 — MVP)
1. **Dashboard** — Stats reais, quick actions
2. **Conexões** — CRUD + test + VPN Wizard (PG, MSSQL, MySQL)
3. **Explorer** — Tree (schema → table → columns/PK/FK)
4. **Query Editor** — SQL, Ctrl+Enter, CSV export, histórico, readonly guard
5. **Monitor** — Queries ativas (WebSocket 5s), locks, kill, stats
6. **Execuções** — Workflow submit → approve → execute (role-based)
7. **Comparador** — Diff entre 2 DBs (tables, views, functions, columns)
8. **Audit Log** — Append-only, filtros, CSV export
9. **Configurações** — Perfil, alterar senha

### MVP Completo ✅ (v0.5.0)
O sprint de 4 semanas foi completado + polish de deploy e VPN UX.

### v0.6.0 — Health Monitor + Database Discovery (2026-05-25)

| Versão | Commit | Descrição |
|--------|--------|-----------|
| 0.6.0 | (current) | Health Monitor completo + Database Discovery + Edit connection |

### Funcionalidades adicionadas (v0.6.0)
1. **Editar Conexão** — Botão de edição com formulário preenchido
2. **Database opcional** — Conexão sem DB = conecta no servidor inteiro
3. **Descoberta de Databases** — Lupa lista todos os DBs, seleciona quais monitorar
4. **Health Monitor** — Nova página com 5 tabs:
   - Visão Geral (cards de resumo com semáforo)
   - Tabelas (bloat, dead tuples, vacuum, scans)
   - Queries Lentas (pg_stat_statements / DMVs)
   - Índices (não usados + sugestões)
   - Configurações (parâmetros críticos)
5. **Suporte PG + MSSQL** — Ambos com health monitoring completo

### v0.7.0 — Alertas Configuráveis por Regras de Negócio (2026-05-25)

| Versão | Commit | Descrição |
|--------|--------|-----------|
| 0.7.0 | (current) | Sistema completo de alertas com scheduler, wizard 3 passos, histórico |

### Funcionalidades adicionadas (v0.7.0)
1. **Alertas configuráveis** — Queries SQL customizadas que rodam periodicamente
2. **Wizard 3 passos** — Conexão → Query (com teste) → Condição + Frequência
3. **Tipos de avaliação** — has_rows, no_rows, threshold (>, <, =, !=, >=, <=)
4. **Scheduler interno** — Timer por alerta com min 30s, timeout 10s
5. **Validação de SQL** — Rejeita DML (INSERT/UPDATE/DELETE/DROP)
6. **Histórico** — Timeline com status, valor, tempo de execução
7. **Badge no header** — Contagem de alertas disparados com pulse animation
8. **WebSocket push** — Notifica em tempo real quando alerta dispara
9. **Severidade** — Info/Warning/Critical com cores distintas
10. **Ações** — Testar, Pausar/Ativar, Editar, Excluir

### v0.9.0 — Comparador de Schema Completo
- Comparação completa: tabelas, colunas (tipo/nullable/default/PK/FK), índices, triggers, procedures, functions, views
- Diff de corpo/definição SQL para triggers, procedures, functions e views
- UI side-by-side para código diferente (source vs target)
- Summary cards com contagem por categoria
- Tabs por tipo de objeto
- Auto-detect schema (public PG / dbo MSSQL)
- Fix: VPN network_mode para backend acessar bancos do cliente
- Fix: Frontend proxy (VITE_API_URL vazio, proxy via docker gateway)
- Fix: MSSQL arithmetic overflow (CAST BIGINT)

## v0.8.0 — Growth Tracker (Cron Diário de Crescimento) (2026-05-25)

| Versão | Commit | Descrição |
|--------|--------|-----------|
| 0.8.0 | (current) | Monitoramento de crescimento de tabelas com cron diário, detecção de anomalias, sparklines |

### Funcionalidades adicionadas (v0.8.0)
1. **Snapshot diário** — Cron à meia-noite UTC coleta row count e tamanho de todas as tabelas
2. **Detecção de anomalias** — Spike (>3x média), Parou (0 vs esperado), Perda (encolheu >10%)
3. **Baseline 7 dias** — Média de crescimento calculada automaticamente
4. **Regras customizáveis por tabela** — max growth %, max rows, min rows, max shrink %
5. **Sparklines** — Mini gráfico de tendência na tabela
6. **Snapshot manual** — Botão para forçar coleta imediata
7. **WebSocket push** — Notifica anomalias em tempo real
8. **Zero impacto** — Usa pg_stat_user_tables (metadado), não faz COUNT real

### Próximos passos opcionais:
- Syntax highlight (CodeMirror / Monaco)
- Temas claros
- Notificações push (execuções pendentes)
- Backup/restore management
- Schema versioning (git-like)
- ER Diagram visual
- Alertas automáticos de saúde
