-- DBA Analyser - Rollback (DROP ALL)
-- ⚠️ CUIDADO: Remove TODAS as tabelas e dados!

DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS execution_requests CASCADE;
DROP TABLE IF EXISTS connections CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP EXTENSION IF EXISTS "uuid-ossp";
DROP EXTENSION IF EXISTS "pgcrypto";
