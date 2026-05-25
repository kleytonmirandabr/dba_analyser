# SCRIPT_DB

Scripts SQL para gerenciamento do banco de dados interno do DBA Analyser.

## Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `001_init.sql` | Criação completa do schema (tables, indexes, rules, seed) |
| `002_migrations.sql` | Migrations incrementais (futuras versões) |
| `999_rollback.sql` | DROP de todas as tabelas (⚠️ destrutivo) |

## Como usar

### Primeira instalação (sem Docker)
```bash
createdb dba_analyser
psql -d dba_analyser -f SCRIPT_DB/001_init.sql
```

### Com Docker (recomendado)
O `docker-compose.yml` já cria o banco automaticamente via TypeORM `synchronize: true` em dev.
Para produção, desabilite `synchronize` e rode os scripts manualmente:

```bash
docker exec -i dba_analyser-postgres-1 psql -U dba_app -d dba_analyser < SCRIPT_DB/001_init.sql
```

### Rollback completo
```bash
docker exec -i dba_analyser-postgres-1 psql -U dba_app -d dba_analyser < SCRIPT_DB/999_rollback.sql
```

## Credenciais padrão
- **User:** `dba_app`
- **Password:** `dba_secret`
- **Database:** `dba_analyser`
- **Admin login:** `admin@dba-analyser.local` / `admin123`

## Regras de segurança
- Tabela `audit_logs` tem RULES que impedem UPDATE e DELETE
- Senhas de conexões são criptografadas com AES-256-GCM (nunca em texto puro)
- O campo `passwordHash` dos users usa bcrypt (custo 10)
