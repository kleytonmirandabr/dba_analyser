# ANÁLISE COMPLETA — DBA ANALYSER

> Documento de análise nas visões de DBA, Desenvolvedor, Requisitos e Arquiteto.

---

## 🗄️ VISÃO DO DBA

### Dores Atuais

| # | Dor | Impacto |
|---|-----|---------|
| 1 | Falta de visibilidade centralizada dos bancos | Perda de tempo navegando pgAdmin/SSMS individualmente |
| 2 | Comparação manual em implantação/atualização | Erros em produção por tabela/trigger/procedure divergente |
| 3 | Problemas só detectados quando usuário liga | 10-30min de downtime até identificar query travada ou lock |
| 4 | Execução manual em múltiplos bancos | Erro humano: esquece banco, roda versão errada, banco errado |
| 5 | Sem histórico/versionamento do schema | Impossível saber "o que mudou e quando" |

### O que o DBA precisa

| Necessidade | Prioridade | Critério de aceite |
|---|---|---|
| Ver todos os bancos num lugar só | P0 | Dashboard com lista, status online/offline, tamanho |
| Explorar objetos sem abrir pgAdmin | P0 | Tree: schemas > tabelas > colunas/indexes/triggers |
| Comparar banco A vs B | P0 | Diff visual com destaque (novo/removido/modificado) |
| Ver queries ativas e locks em tempo real | P0 | Tela com WebSocket, refresh < 3s, alerta visual |
| Executar script com segurança | P1 | Preview → aprovação → execução → log |
| Matar query travada | P1 | Botão Kill com confirmação e audit log |
| Histórico de alterações | P2 | Timeline de mudanças por banco |
| Alertas automáticos | P2 | Notificação quando threshold ultrapassado |

### Queries internas por banco

**PostgreSQL:**
```sql
-- Tabelas
SELECT schemaname, tablename FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema');

-- Procedures/Functions
SELECT routine_name, routine_type, routine_definition FROM information_schema.routines WHERE routine_schema='public';

-- Triggers
SELECT trigger_name, event_object_table, action_timing, event_manipulation, action_statement FROM information_schema.triggers;

-- Indexes
SELECT indexname, tablename, indexdef FROM pg_indexes WHERE schemaname='public';

-- Views
SELECT viewname, definition FROM pg_views WHERE schemaname='public';

-- Queries ativas
SELECT pid, usename, state, query, now()-query_start as duration FROM pg_stat_activity WHERE state!='idle' ORDER BY duration DESC;

-- Locks
SELECT blocked.pid, blocked.query, blocking.pid as blocker_pid, blocking.query as blocker_query
FROM pg_stat_activity blocked
JOIN pg_locks bl ON bl.pid=blocked.pid
JOIN pg_locks kl ON kl.locktype=bl.locktype AND kl.relation IS NOT DISTINCT FROM bl.relation AND kl.pid!=bl.pid AND NOT bl.granted
JOIN pg_stat_activity blocking ON blocking.pid=kl.pid;

-- Tamanho
SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) FROM pg_catalog.pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC;
```

**SQL Server:**
```sql
-- Queries ativas
SELECT r.session_id, r.status, r.command, t.text, r.wait_type, r.total_elapsed_time
FROM sys.dm_exec_requests r CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t;

-- Locks
SELECT resource_type, request_mode, request_status, request_session_id FROM sys.dm_tran_locks WHERE resource_database_id=DB_ID();

-- Tabelas
SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE';

-- Procedures
SELECT SPECIFIC_SCHEMA, SPECIFIC_NAME, ROUTINE_DEFINITION FROM INFORMATION_SCHEMA.ROUTINES;
```

---

## 👨‍💻 VISÃO DO DESENVOLVEDOR

### Stack Completa

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Frontend framework | React | 18.3+ |
| Build tool | Vite | 5.x |
| Linguagem | TypeScript | 5.4+ |
| Styling | Tailwind CSS | 3.4+ |
| UI Components | shadcn/ui | latest |
| State | Zustand | 4.5+ |
| HTTP client | Axios | 1.6+ |
| Real-time | socket.io-client | 4.7+ |
| SQL Editor | Monaco Editor | 4.6+ |
| Diff view | react-diff-viewer-continued | 3.4+ |
| Backend framework | Express | 4.18+ |
| ORM | TypeORM | 0.3+ |
| DB interno | PostgreSQL | 16 |
| DB connectors | pg, mssql, mysql2 | latest |
| WebSocket | socket.io (server) | 4.7+ |
| Validation | Zod | 3.22+ |
| Auth | jsonwebtoken + bcryptjs | latest |
| Encryption | crypto (native Node.js) | built-in |
| Container | Docker + Compose | latest |

### Adapter Pattern

```typescript
// adapters/base.adapter.ts — Interface que TODO adapter implementa
export interface DatabaseAdapter {
  // Lifecycle
  connect(config: ConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  testConnection(): Promise<{ ok: boolean; version: string; error?: string }>;
  
  // Explorer
  listDatabases(): Promise<DatabaseInfo[]>;
  listSchemas(database: string): Promise<string[]>;
  listTables(schema: string): Promise<TableInfo[]>;
  listColumns(schema: string, table: string): Promise<ColumnInfo[]>;
  listIndexes(schema: string, table: string): Promise<IndexInfo[]>;
  listConstraints(schema: string, table: string): Promise<ConstraintInfo[]>;
  listTriggers(schema?: string): Promise<TriggerInfo[]>;
  listProcedures(schema?: string): Promise<ProcedureInfo[]>;
  listFunctions(schema?: string): Promise<FunctionInfo[]>;
  listViews(schema?: string): Promise<ViewInfo[]>;
  listSequences(schema?: string): Promise<SequenceInfo[]>;
  getObjectDDL(type: ObjectType, name: string, schema?: string): Promise<string>;
  
  // Monitor
  getActiveQueries(): Promise<ActiveQuery[]>;
  getLocks(): Promise<LockInfo[]>;
  getSlowQueries(thresholdMs: number): Promise<SlowQuery[]>;
  getConnectionStats(): Promise<ConnectionStats>;
  killQuery(pid: number): Promise<{ success: boolean; error?: string }>;
  
  // Execution
  executeSQL(sql: string, timeout?: number): Promise<ExecutionResult>;
  executeInTransaction(sqls: string[]): Promise<ExecutionResult>;
}
```

### Padrões de Código

- Arquivos < 300 linhas (decompor se ultrapassar)
- Services puros (sem dependência de Express)
- Routes finas: validação (Zod) → service call → response format
- Responses: `{ data, error?, meta? }`
- Erros tipados com código HTTP + mensagem
- Commits: conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`)
- Variáveis/funções em inglês, UI em português

---

## 📝 VISÃO DE REQUISITOS

### Requisitos Funcionais

#### RF01 — Gerenciamento de Conexões
| ID | Requisito | P |
|---|---|---|
| RF01.1 | Cadastrar conexão (host, porta, database, user, senha, tipo) | P0 |
| RF01.2 | Classificar por ambiente (DEV, HML, PROD) | P0 |
| RF01.3 | Testar conexão antes de salvar | P0 |
| RF01.4 | Senha armazenada com AES-256-GCM | P0 |
| RF01.5 | Ativar/desativar conexão | P1 |
| RF01.6 | Agrupar por cliente/projeto | P2 |

#### RF02 — Permissões e Segurança
| ID | Requisito | P |
|---|---|---|
| RF02.1 | Modo por conexão: READ_ONLY ou EXECUTE | P0 |
| RF02.2 | Permissão do sistema sobrepõe GRANT do banco | P0 |
| RF02.3 | Execução requer aprovação (exceto DEV auto-approve) | P0 |
| RF02.4 | Roles: ADMIN, DBA, VIEWER | P0 |
| RF02.5 | VIEWER: só consulta | P0 |
| RF02.6 | DBA: consulta + solicita execução | P0 |
| RF02.7 | ADMIN: tudo + aprovação + config | P0 |
| RF02.8 | Whitelist/blacklist de operações SQL por conexão | P1 |
| RF02.9 | Bloqueio automático de DROP DATABASE/TRUNCATE em PROD | P1 |
| RF02.10 | Timeout configurável por conexão | P2 |

#### RF03 — Explorer (Catálogo)
| ID | Requisito | P |
|---|---|---|
| RF03.1 | Listar databases de uma conexão | P0 |
| RF03.2 | Listar schemas, tabelas, views | P0 |
| RF03.3 | Detalhe de tabela: colunas, tipos, nullable, default, PK/FK | P0 |
| RF03.4 | Listar indexes | P0 |
| RF03.5 | Listar triggers com código e eventos | P0 |
| RF03.6 | Listar procedures com código e parâmetros | P0 |
| RF03.7 | Listar functions com código, parâmetros, return | P0 |
| RF03.8 | Busca global por nome de objeto | P1 |
| RF03.9 | Exportar DDL (CREATE statement) | P1 |
| RF03.10 | Tamanho de tabelas (rows + bytes) | P2 |
| RF03.11 | Dependências entre objetos | P2 |

#### RF04 — Comparador de Schema
| ID | Requisito | P |
|---|---|---|
| RF04.1 | Selecionar Origem vs Destino para comparar | P0 |
| RF04.2 | Comparar tabelas (existência, colunas, tipos, constraints) | P0 |
| RF04.3 | Comparar indexes | P0 |
| RF04.4 | Comparar triggers (existência, código, eventos) | P0 |
| RF04.5 | Comparar procedures/functions (existência, código, params) | P0 |
| RF04.6 | Comparar views (existência, definição) | P0 |
| RF04.7 | Resultado: ✅ igual, ➕ só origem, ➖ só destino, ⚠️ diferente | P0 |
| RF04.8 | Diff lado-a-lado do código (style git) | P0 |
| RF04.9 | Gerar script SQL de migração | P0 |
| RF04.10 | Preview do script antes de executar | P0 |
| RF04.11 | Executar no destino (respeitando permissões) | P1 |
| RF04.12 | Salvar comparação para consulta futura | P2 |

#### RF05 — Monitor Real-time
| ID | Requisito | P |
|---|---|---|
| RF05.1 | Queries em execução com duração real-time | P0 |
| RF05.2 | Detectar e mostrar locks (blocker → blocked) | P0 |
| RF05.3 | Destacar queries lentas (> threshold) | P0 |
| RF05.4 | Conexões ativas por database | P0 |
| RF05.5 | Kill query com confirmação | P1 |
| RF05.6 | Alertas visuais (badge, cor) | P1 |
| RF05.7 | Histórico de alertas | P2 |
| RF05.8 | Notificação externa (email/webhook) | P2 |

#### RF06 — Execução Controlada
| ID | Requisito | P |
|---|---|---|
| RF06.1 | Editor SQL com syntax highlighting | P0 |
| RF06.2 | Preview antes de submeter | P0 |
| RF06.3 | Workflow: Rascunho → Pendente → Aprovado → Executado | P0 |
| RF06.4 | Selecionar bancos destino | P0 |
| RF06.5 | Execução em transação com rollback em erro | P0 |
| RF06.6 | Log: quem solicitou, aprovou, quando, output | P0 |
| RF06.7 | Gerar rollback script automático | P1 |
| RF06.8 | Execução em lote (múltiplos bancos) | P1 |

#### RF07 — Audit Log
| ID | Requisito | P |
|---|---|---|
| RF07.1 | Registrar toda ação (login, consulta, execução, aprovação) | P0 |
| RF07.2 | Filtrar por usuário, data, ação, conexão | P0 |
| RF07.3 | Detalhe: SQL, resultado, duração | P0 |
| RF07.4 | Exportar CSV | P2 |

### Requisitos Não-Funcionais

| ID | Requisito | Métrica |
|---|---|---|
| RNF01 | Credenciais nunca em logs/responses/frontend | 0 ocorrências |
| RNF02 | Explorer < 3s para 500 tabelas | p95 < 3000ms |
| RNF03 | Monitor refresh < 3s via WebSocket | Latência < 3000ms |
| RNF04 | Comparação de 200 tabelas < 30s | p95 < 30000ms |
| RNF05 | 1 comando para subir (`docker compose up`) | Testável |
| RNF06 | Dark mode em 100% das telas | Visual |
| RNF07 | Foco desktop (>= 1024px) | Responsivo básico |
| RNF08 | Zero SQL injection | Auditável |

---

## 🏗️ VISÃO DO ARQUITETO

### ADRs (Architectural Decision Records)

#### ADR-001: Monorepo

**Decisão:** frontend/ + backend/ no mesmo repositório.
**Motivo:** Simplicidade, 1-3 devs, versionamento único, Docker Compose unificado.

#### ADR-002: Express com Middleware Pattern

**Decisão:** Express (não custom router).
**Motivo:** Auth → Permission → Audit encadeia naturalmente. Ecossistema maduro.

#### ADR-003: Adapter Pattern para Multi-DB

**Decisão:** Interface `DatabaseAdapter` com implementação por vendor.
**Motivo:** Queries de catálogo são completamente diferentes entre PG/MSSQL/MySQL. Testável com mock.

#### ADR-004: PostgreSQL como DB Interno

**Decisão:** PG 16 para armazenar conexões, logs, usuários do sistema.
**Motivo:** TypeORM nativo, JSONB para configs, migrations automáticas. SQLite limitaria concorrência.

#### ADR-005: WebSocket para Monitor

**Decisão:** Socket.io com rooms por conexão.
**Motivo:** Polling HTTP seria N×N×N requests. WS mantém 1 conexão por cliente. Server faz polling condicional (só se room tem clientes).

#### ADR-006: Permissão do Sistema > GRANT do Banco

**Decisão:** Camada própria de permissão que é MAIS RESTRITIVA que o banco.
**Motivo:** Segurança em camadas. Mesmo que o user do banco seja superuser, o sistema controla o que executa.

#### ADR-007: Diff Engine Custom

**Decisão:** Implementar comparação própria ao invés de lib externa.
**Motivo:** Libs existentes são CLI (não libs). Precisamos de output JSON estruturado e controle fino.

#### ADR-008: AES-256-GCM para Credenciais

**Decisão:** Encryption at rest com master key em env var + salt por conexão.
**Motivo:** Credenciais descriptografadas just-in-time (1 request), nunca em cache.

#### ADR-009: Docker como Ambiente Obrigatório

**Decisão:** Tudo roda em Docker Compose, inclusive desenvolvimento.
**Motivo:** VPN na máquina do Kleyton = precisa rodar local. Docker garante reprodutibilidade sem instalar Node/PG na máquina.

### Modelo de Dados (DB Interno)

```sql
-- Usuários do sistema
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'viewer',  -- admin, dba, viewer
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Conexões cadastradas
CREATE TABLE connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  host VARCHAR(255) NOT NULL,
  port INTEGER NOT NULL,
  database_name VARCHAR(100) NOT NULL,
  username VARCHAR(100) NOT NULL,
  password_encrypted TEXT NOT NULL,
  password_salt VARCHAR(64) NOT NULL,
  db_type VARCHAR(20) NOT NULL,                 -- postgresql, mssql, mysql
  environment VARCHAR(20) NOT NULL,             -- dev, hml, prod
  mode VARCHAR(20) NOT NULL DEFAULT 'readonly', -- readonly, execute
  auto_approve BOOLEAN DEFAULT false,
  allowed_operations TEXT[],
  blocked_operations TEXT[],
  query_timeout_ms INTEGER DEFAULT 30000,
  is_active BOOLEAN DEFAULT true,
  group_name VARCHAR(100),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Solicitações de execução
CREATE TABLE execution_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES connections(id),
  requested_by UUID NOT NULL REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  sql_text TEXT NOT NULL,
  description TEXT,
  rollback_sql TEXT,
  execution_result TEXT,
  execution_duration_ms INTEGER,
  error_message TEXT,
  requested_at TIMESTAMP DEFAULT NOW(),
  approved_at TIMESTAMP,
  executed_at TIMESTAMP
);

-- Audit log (append-only)
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  connection_id UUID,
  target_object VARCHAR(255),
  sql_text TEXT,
  result VARCHAR(20),
  error_message TEXT,
  duration_ms INTEGER,
  ip_address VARCHAR(45),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Schema snapshots
CREATE TABLE schema_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES connections(id),
  snapshot_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Comparações salvas
CREATE TABLE comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_connection_id UUID REFERENCES connections(id),
  target_connection_id UUID REFERENCES connections(id),
  diff_result JSONB NOT NULL,
  migration_sql TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Configuração de alertas
CREATE TABLE alert_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES connections(id),
  alert_type VARCHAR(50) NOT NULL,
  threshold_value INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  notify_email BOOLEAN DEFAULT false,
  notify_webhook VARCHAR(500),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Diagrama de Segurança

```
┌──────────────────────────────────────────────────────────┐
│                      FRONTEND                            │
│  (nunca recebe senhas, nunca executa SQL direto)          │
└───────────────────────────┬──────────────────────────────┘
                            │ JWT Token (HttpOnly cookie)
┌───────────────────────────┴──────────────────────────────┐
│                      BACKEND                             │
│                                                          │
│  [Auth MW] → [Permission MW] → [Audit MW] → [Handler]   │
│       │              │               │                   │
│       │    ┌─────────┴────────────┐  │                   │
│       │    │  EXECUTION GUARD     │  │                   │
│       │    │  • connection.mode   │  │                   │
│       │    │  • user.role         │  │                   │
│       │    │  • operation whitelist│ │                   │
│       │    │  • approval required │  │                   │
│       │    │  • dangerous op block│  │                   │
│       │    └─────────┬────────────┘  │                   │
│       │              │               │                   │
│  ┌────┴──────────────┴───────────────┴────────────────┐  │
│  │              DB ADAPTER LAYER                       │  │
│  │  • Decrypt just-in-time (1 request)                │  │
│  │  • Connect with timeout                            │  │
│  │  • Execute with timeout                            │  │
│  │  • NEVER log credentials                           │  │
│  │  • Parametrized queries ONLY                       │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Riscos e Mitigações

| Risco | Severidade | Mitigação |
|-------|-----------|-----------|
| Credenciais vazam | ALTA | Middleware de filtro; nunca em response; AES at rest |
| Execução acidental em PROD | ALTA | Double-confirm + approval + READ_ONLY default |
| SQL injection no sistema | ALTA | 100% parametrizado + Zod validation |
| WebSocket sobrecarrega bancos | MÉDIA | Polling condicional + interval config |
| Master key perdida | MÉDIA | Documentar rotação; env var com backup |
| Banco lento trava app | BAIXA | Timeouts + connection pooling |


---

## 🔌 MÓDULO VPN (Adendo)

### Requisitos Funcionais — VPN

| ID | Requisito | P |
|---|---|---|
| RF-VPN.1 | Upload de arquivo .ovpn via interface web | P0 |
| RF-VPN.2 | Informar user/pass da VPN (quando necessário) | P0 |
| RF-VPN.3 | Armazenar config VPN com AES-256 (mesmo padrão das credenciais de banco) | P0 |
| RF-VPN.4 | Iniciar/parar conexão VPN via interface | P0 |
| RF-VPN.5 | Exibir status da VPN em tempo real (conectado/desconectado/reconectando) | P0 |
| RF-VPN.6 | Reconexão automática se túnel cair | P0 |
| RF-VPN.7 | Healthcheck a cada 30s (ping em host interno) | P0 |
| RF-VPN.8 | Wizard de primeiro acesso: VPN → Conexão → Teste | P0 |
| RF-VPN.9 | Bloquear cadastro de conexão se VPN não estiver ativa | P1 |
| RF-VPN.10 | Suportar múltiplos perfis VPN (ex: VPN cliente A, VPN cliente B) | P2 |
| RF-VPN.11 | Logs da VPN acessíveis via interface (debug) | P2 |

### Arquitetura VPN

```
Wizard UI (primeiro acesso)
│
├── Passo 1: "Sua rede requer VPN?"
│   └── Sim → Upload do .ovpn
│   └── Não → Pular, ir direto para conexão de banco
│
├── Passo 2: Credenciais VPN (opcional - alguns .ovpn já tem embutido)
│   └── Usuário + Senha → armazena criptografado
│
├── Passo 3: Conectar
│   └── Backend escreve .ovpn no volume vpn-data
│   └── Reinicia container VPN (docker restart via API)
│   └── Aguarda healthcheck passar
│   └── Exibe: "VPN Conectada ✅ - IP interno: 10.x.x.x"
│
├── Passo 4: Cadastrar conexão de banco
│   └── Host (agora acessível via VPN), porta, database, user, senha
│   └── Testar conexão → ✅ ou ❌
│
└── Passo 5: Pronto!
    └── Redireciona para Dashboard
```

### Detalhes Técnicos

**Container VPN:**
- Imagem: `dperson/openvpn-client` (OpenVPN 2.5+)
- Capabilities: `NET_ADMIN`
- Devices: `/dev/net/tun`
- Volume: `vpn-data:/vpn` (persiste configs entre restarts)
- Healthcheck: `ping -c 1 -W 3 8.8.8.8` (ou IP interno configurável)

**Backend gerencia VPN via:**
```typescript
// services/vpn.service.ts
export class VPNService {
  // Upload e armazena .ovpn criptografado
  async uploadConfig(ovpnFile: Buffer, credentials?: { user: string; pass: string }): Promise<void>;
  
  // Escreve config no volume e reinicia container
  async connect(): Promise<{ success: boolean; assignedIp?: string; error?: string }>;
  
  // Para a VPN
  async disconnect(): Promise<void>;
  
  // Verifica estado atual
  async getStatus(): Promise<{
    connected: boolean;
    ip?: string;
    uptime?: string;
    lastError?: string;
    configUploaded: boolean;
  }>;
  
  // Logs do OpenVPN (últimas N linhas)
  async getLogs(lines?: number): Promise<string[]>;
  
  // Remove config (reset)
  async removeConfig(): Promise<void>;
}
```

**Como o backend reinicia o container VPN:**
- Opção 1: Monta `/var/run/docker.sock` no backend → usa dockerode para `docker restart vpn`
- Opção 2: Escreve config no volume compartilhado → OpenVPN detecta mudança (inotify)
- **Recomendado:** Opção 1 (controle total)

**Segurança:**
- Arquivo .ovpn NUNCA é retornado pela API (nem parcialmente)
- Credenciais VPN criptografadas com mesma master key do sistema
- Container VPN isolado — não tem acesso ao DB interno nem ao frontend
- Se VPN cair, backend retorna HTTP 503 "VPN desconectada" nas rotas de banco

### Diagrama de Rede Docker

```
┌─── docker network: dba_default ───────────────────────────┐
│                                                           │
│  ┌──────────┐         ┌──────────────────────────────┐    │
│  │ frontend │◀───────▶│ vpn (network_mode: bridge)   │    │
│  │ :80/5173 │  HTTP   │  ┌────────┐  ┌───────────┐  │    │
│  └──────────┘  :3030  │  │backend │  │ openvpn   │──┼───▶ 10.x.x.x (rede VPN)
│                       │  │        │  │ client    │  │    │
│  ┌──────────┐         │  └────────┘  └───────────┘  │    │
│  │ postgres │         └──────────────────────────────┘    │
│  │ :5432    │ (acessível pelo backend via hostname)        │
│  └──────────┘                                             │
│                                                           │
└───────────────────────────────────────────────────────────┘

Nota: Backend e OpenVPN compartilham o mesmo network namespace
      (network_mode: "service:vpn"). Isso significa que quando
      o backend faz pg.connect("10.8.0.50:5432"), o tráfego
      sai pelo túnel VPN automaticamente.
```


---

## 💡 CONTRIBUIÇÕES ADICIONAIS DO ARQUITETO

### 1. Schema Versioning (Git para Banco de Dados)

Além de comparar dois bancos ao vivo, o sistema pode **versionar** o schema automaticamente:

```
Toda vez que o DBA conecta no Explorer ou executa um diff:
  → Sistema tira "snapshot" do catálogo completo (JSON)
  → Salva na tabela schema_snapshots com timestamp
  → Permite comparar "banco hoje" vs "banco há 2 semanas"
  → Timeline visual de mudanças
```

**Valor:** Responde "o que mudou e quando?" sem precisar de diff ao vivo com outro banco.

---

### 2. Script Library (Biblioteca de Scripts)

Templates prontos para operações comuns:

| Template | SQL |
|----------|-----|
| Adicionar coluna | `ALTER TABLE {table} ADD COLUMN {name} {type} {nullable} {default};` |
| Adicionar index | `CREATE INDEX idx_{table}_{cols} ON {table} ({cols});` |
| Adicionar FK | `ALTER TABLE {table} ADD CONSTRAINT fk_{name} FOREIGN KEY ({col}) REFERENCES {ref_table}({ref_col});` |
| Recriar trigger | `DROP TRIGGER IF EXISTS {name} ON {table}; CREATE TRIGGER...` |
| Refresh materialized view | `REFRESH MATERIALIZED VIEW CONCURRENTLY {name};` |
| Vacuum analyze | `VACUUM ANALYZE {table};` |
| Reindex | `REINDEX INDEX CONCURRENTLY {name};` |

O DBA seleciona template, preenche parâmetros, preview, executa com aprovação.

---

### 3. Health Score por Banco

Dashboard com "nota de saúde" calculada:

| Métrica | Peso | Bom | Ruim |
|---------|------|-----|------|
| Cache hit ratio | 25% | > 99% | < 95% |
| Index usage ratio | 20% | > 95% | < 80% |
| Dead tuples / live tuples | 15% | < 5% | > 20% |
| Long running queries (> 30s) | 15% | 0 | > 3 |
| Locks ativos | 15% | 0 | > 2 |
| Conexões ativas / max | 10% | < 50% | > 80% |

Resultado: 🟢 Saudável (> 80) | 🟡 Atenção (50-80) | 🔴 Crítico (< 50)

Visível no dashboard principal, badge no card de cada conexão.

---

### 4. Query Explain Visualizer

Quando o DBA identifica uma query lenta no Monitor:
- Botão "Explain" → roda `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`
- Visualiza o plano de execução como árvore
- Destaca nós caros (Seq Scan em tabela grande, Nested Loop com muitas rows)
- Sugere indexes (baseado em Filter conditions sem index)

---

### 5. Notificações Proativas

Além de alertas no browser, o sistema pode notificar:

| Canal | Quando |
|-------|--------|
| Email | Query > 60s, Lock > 30s, VPN caiu |
| Webhook (Slack/Teams) | Mesmos triggers |
| Badge no browser | Query > 30s (threshold configurável) |
| Som | Lock detectado (configurável) |

---

### 6. Comparação Agendada (Drift Detection)

Configurar: "Compare PROD vs HML todo dia às 6h"
- Se drift detectado → notificação
- Relatório: "3 tabelas divergentes, 1 procedure diferente"
- Histórico de drifts ao longo do tempo

Isso responde à dor: "implantação quebrou e eu só descubro quando o cliente liga"

---

### 7. Exportação de Schema Completo

Botão "Exportar DDL" que gera:
```sql
-- DBA Analyser - Export completo
-- Banco: photocoat_prod
-- Data: 2026-05-25 15:00:00
-- Objetos: 45 tabelas, 12 triggers, 8 procedures, 3 views

CREATE TABLE users (...);
CREATE TABLE orders (...);
...
CREATE OR REPLACE FUNCTION calc_total() ...;
CREATE TRIGGER trg_updated_at ...;
```

Valor: backup de schema legível + versionável no Git do projeto.

---

### 8. Integração Futura — CI/CD

Fase futura: CLI que roda no pipeline de deploy:

```bash
# No GitHub Actions / GitLab CI:
dba-analyser diff --source=hml --target=prod --fail-on-drift
# Se houver diferença → pipeline falha → dev corrige antes de deployar
```

Isso transforma o DBA Analyser de "ferramenta reativa" em "guardrail proativo".
