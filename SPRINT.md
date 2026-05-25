# SPRINT 1 - DBA ANALYSER

## Visão do Produto

**DBA Analyser** é uma ferramenta web para administradores de banco de dados que resolve 4 dores principais:

1. **Visão centralizada** — Conectar múltiplos bancos (PostgreSQL, SQL Server, MySQL) e ter um painel único com todas as informações relevantes (tabelas, triggers, procedures, functions, views)
2. **Comparação de schemas** — Comparar dois bancos lado a lado e ver exatamente o que está diferente (tabela faltando, coluna divergente, trigger desatualizada, procedure com código diferente)
3. **Monitoramento em tempo real** — Ver queries travadas, locks, conexões ativas, queries lentas SEM precisar esperar o usuário ligar reclamando
4. **Execução controlada de alterações** — Selecionar quais diferenças aplicar e executar o script de atualização com segurança (preview do SQL antes, rollback)

---

## Stack Tecnológica

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| **Frontend** | React + TypeScript + Vite | Moderno, rápido, você já conhece do Photocoat |
| **UI** | Tailwind CSS + shadcn/ui | Consistente, dark mode, componentes prontos |
| **Backend** | Node.js + Express + TypeScript | Mesmo ecossistema, npm packages para todos os DBs |
| **DB Connectors** | `pg` (PostgreSQL), `mssql` (SQL Server), `mysql2` (MySQL) | Libs maduras e mantidas |
| **Schema Diff** | Custom engine inspirado em `pg-diff` | Controle total sobre a comparação |
| **Monitoramento** | WebSocket (socket.io) | Real-time updates sem polling |
| **Auth** | JWT simples (single user ou multi-tenant futuro) | Segurança básica pois lida com credentials |
| **Deploy** | Docker Compose | Self-hosted, roda em qualquer servidor |

---

## Módulos (Features)

### 📡 Módulo 1: Conexões
- Cadastrar conexões (host, porta, user, senha, tipo: pg/mssql/mysql)
- Testar conexão antes de salvar
- Criptografia das credenciais em repouso (AES-256)
- Agrupar conexões por ambiente (DEV, HML, PROD)

### 🗂️ Módulo 2: Explorer (Catálogo)
- Listar todos os databases de uma conexão
- Para cada database: tabelas, views, triggers, procedures, functions, indexes
- Detalhes de cada objeto (colunas, tipos, constraints, código-fonte)
- Busca global por nome de objeto
- Exportar DDL de qualquer objeto

### 🔍 Módulo 3: Comparador de Schema
- Selecionar Banco A (origem) vs Banco B (destino)
- Comparar:
  - Tabelas (colunas, tipos, defaults, nullable, constraints)
  - Indexes
  - Triggers (código e eventos)
  - Procedures/Functions (código, parâmetros, return type)
  - Views (definição SQL)
  - Sequences
- Resultado visual tipo "diff" (verde = novo, vermelho = removido, amarelo = modificado)
- Gerar script SQL de migração (ALTER, CREATE, DROP)
- Preview do script antes de executar
- Executar no destino com confirmação

### 📊 Módulo 4: Monitor (Real-time)
- Queries ativas / em execução agora
- Locks detectados (blocker → blocked)
- Queries lentas (> X segundos configurável)
- Conexões ativas por database
- Alertas configuráveis (ex: "query > 30s", "lock > 5s", "conexões > 100")
- Kill query direto pela interface (com confirmação)
- Histórico de alertas

### 🚀 Módulo 5: Deploy Manager
- Criar "pacotes de alteração" (conjunto de SQLs)
- Selecionar quais bancos recebem o pacote
- Executar em sequência ou paralelo
- Log de execução (sucesso/erro por banco)
- Rollback script gerado automaticamente
- Histórico de deploys com diff do que foi alterado

---

## Arquitetura

```
┌─────────────────────────────────────────┐
│           FRONTEND (React)              │
│  Dashboard │ Explorer │ Diff │ Monitor  │
└──────────────────┬──────────────────────┘
                   │ REST + WebSocket
┌──────────────────┴──────────────────────┐
│           BACKEND (Node.js)             │
│                                         │
│  ┌─────────┐ ┌────────┐ ┌───────────┐  │
│  │ Conn    │ │ Schema │ │ Monitor   │  │
│  │ Manager │ │ Differ │ │ (WS live) │  │
│  └────┬────┘ └───┬────┘ └─────┬─────┘  │
│       │          │             │        │
│  ┌────┴──────────┴─────────────┴─────┐  │
│  │     DB Adapter Layer              │  │
│  │  pg │ mssql │ mysql2             │  │
│  └───────────────────────────────────┘  │
└──────────────────┬──────────────────────┘
                   │
     ┌─────────────┼─────────────┐
     │             │             │
 ┌───┴───┐   ┌────┴────┐  ┌────┴────┐
 │ PG DB │   │ SQL Srv │  │ MySQL   │
 │ (N)   │   │  (N)    │  │  (N)    │
 └───────┘   └─────────┘  └─────────┘
```

---

## Sprint 1 - MVP (4 semanas)

### Semana 1: Fundação + VPN + Conexões
- [ ] Setup monorepo (frontend + backend + Dockerfiles)
- [ ] Docker Compose com OpenVPN sidecar funcionando
- [ ] Backend: Express + TypeScript + TypeORM migrations
- [ ] Backend: VPN Service (upload .ovpn, start/stop, status)
- [ ] Backend: Connection Service (CRUD + AES-256 + test)
- [ ] Backend: Auth (JWT + roles: admin/dba/viewer)
- [ ] Backend: Permission middleware + Audit middleware
- [ ] DB Adapter layer (interface genérica + impl PostgreSQL)
- [ ] Frontend: Layout base (sidebar, header, dark mode)
- [ ] Frontend: Wizard de primeiro acesso (VPN → Conexão → Teste)
- [ ] Frontend: Tela de conexões (cadastro, teste, listagem)
- [ ] Frontend: Status da VPN no header (indicador verde/vermelho)
- [ ] Frontend: Login + proteção de rotas

### Semana 2: Explorer
- [ ] Backend: Listar databases, schemas, tabelas, colunas
- [ ] Backend: Listar triggers, procedures, functions, views, indexes
- [ ] Frontend: Tree view de objetos do banco
- [ ] Frontend: Detalhes de cada objeto (código, estrutura)
- [ ] Busca global por nome

### Semana 3: Comparador
- [ ] Backend: Engine de diff (tabelas + colunas + constraints)
- [ ] Backend: Diff de triggers, procedures, functions
- [ ] Backend: Geração de script SQL de migração
- [ ] Frontend: Tela de comparação (selecionar A vs B)
- [ ] Frontend: Visualização diff lado-a-lado (estilo git diff)
- [ ] Frontend: Preview e execução do script

### Semana 4: Monitor
- [ ] Backend: WebSocket para queries ativas
- [ ] Backend: Detecção de locks
- [ ] Backend: Queries lentas (pg_stat_activity / sys.dm_exec_requests)
- [ ] Frontend: Dashboard real-time
- [ ] Frontend: Kill query com confirmação
- [ ] Frontend: Alertas visuais

---

## Sprint 2 - Evolução (futuro)
- Deploy Manager (pacotes de alteração multi-banco)
- Suporte SQL Server (adapter mssql)
- Suporte MySQL (adapter mysql2)
- Histórico de schemas (snapshots automáticos)
- Agendamento de comparações
- Relatórios PDF
- Multi-tenant / multi-usuário
- Notificações (email/webhook quando alerta disparar)

---

## Referências Técnicas

| Ferramenta | O que aproveitar |
|-----------|-----------------|
| [pg-diff](https://github.com/michaelsogos/pg-diff) | Lógica de comparação de schemas PG |
| [PostgresCompare](https://www.postgrescompare.com/) | UX de comparação visual |
| [pgAdmin](https://www.pgadmin.org/) | Explorer de objetos |
| [Datadog DB Monitoring](https://www.datadoghq.com/) | UX de monitoramento real-time |

---

## Decisões em Aberto

1. **Self-hosted only ou SaaS futuro?** — Impacta auth e multi-tenancy
2. **Credenciais no próprio banco local (SQLite/PG) ou vault externo?**
3. **Suportar Oracle DB?** — Driver é complexo e licenciado
4. **PWA/Desktop (Electron) ou só web?**

---

## Como Rodar (meta)

```bash
# Clone
git clone git@github.com:kleytonmirandabr/dba_analyser.git
cd dba_analyser

# Backend
cd backend && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev

# Ou via Docker
docker compose up
```
