-- DBA Analyser - Script de Inicialização do Banco
-- Versão: 0.4.0
-- Data: 2026-05-25
-- Executar em: PostgreSQL 16+

-- ==========================================
-- CRIAR DATABASE (se necessário)
-- ==========================================
-- CREATE DATABASE dba_analyser;

-- ==========================================
-- EXTENSÕES
-- ==========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- TABELA: users
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  "passwordHash" VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'dba', 'viewer')),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ==========================================
-- TABELA: connections
-- ==========================================
CREATE TABLE IF NOT EXISTS connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  host VARCHAR(255) NOT NULL,
  port INTEGER NOT NULL,
  "databaseName" VARCHAR(100) NOT NULL,
  username VARCHAR(100) NOT NULL,
  "passwordEncrypted" TEXT NOT NULL,
  "passwordSalt" VARCHAR(64) NOT NULL,
  "dbType" VARCHAR(20) NOT NULL CHECK ("dbType" IN ('postgresql', 'mssql', 'mysql')),
  environment VARCHAR(20) NOT NULL CHECK (environment IN ('dev', 'hml', 'prod')),
  mode VARCHAR(20) NOT NULL DEFAULT 'readonly' CHECK (mode IN ('readonly', 'execute')),
  "autoApprove" BOOLEAN NOT NULL DEFAULT false,
  "allowedOperations" TEXT,
  "blockedOperations" TEXT,
  "queryTimeoutMs" INTEGER NOT NULL DEFAULT 30000,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "groupName" VARCHAR(100),
  "createdById" UUID REFERENCES users(id),
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_connections_active ON connections("isActive");
CREATE INDEX idx_connections_env ON connections(environment);
CREATE INDEX idx_connections_dbtype ON connections("dbType");

-- ==========================================
-- TABELA: execution_requests
-- ==========================================
CREATE TABLE IF NOT EXISTS execution_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "connectionId" UUID NOT NULL REFERENCES connections(id),
  "requestedById" UUID NOT NULL REFERENCES users(id),
  "approvedById" UUID REFERENCES users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executed', 'failed')),
  "sqlText" TEXT NOT NULL,
  description TEXT,
  "rollbackSql" TEXT,
  "executionResult" TEXT,
  "executionDurationMs" INTEGER,
  "errorMessage" TEXT,
  "requestedAt" TIMESTAMP NOT NULL DEFAULT now(),
  "approvedAt" TIMESTAMP,
  "executedAt" TIMESTAMP
);

CREATE INDEX idx_exec_requests_status ON execution_requests(status);
CREATE INDEX idx_exec_requests_conn ON execution_requests("connectionId");
CREATE INDEX idx_exec_requests_requested ON execution_requests("requestedAt" DESC);

-- ==========================================
-- TABELA: audit_logs (APPEND-ONLY)
-- ==========================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  "userId" UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  "connectionId" UUID,
  "targetObject" VARCHAR(255),
  "sqlText" TEXT,
  result VARCHAR(20),
  "errorMessage" TEXT,
  "durationMs" INTEGER,
  "ipAddress" VARCHAR(45),
  metadata JSONB,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now()
);

-- IMPORTANTE: Nunca permitir UPDATE/DELETE nesta tabela
CREATE INDEX idx_audit_logs_user ON audit_logs("userId");
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_conn ON audit_logs("connectionId");
CREATE INDEX idx_audit_logs_created ON audit_logs("createdAt" DESC);

-- Regra para impedir DELETE/UPDATE
CREATE OR REPLACE RULE audit_no_update AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
CREATE OR REPLACE RULE audit_no_delete AS ON DELETE TO audit_logs DO INSTEAD NOTHING;

-- ==========================================
-- SEED: Admin padrão
-- ==========================================
INSERT INTO users (name, email, "passwordHash", role, "isActive")
VALUES (
  'Administrador',
  'admin@dba-analyser.local',
  -- bcrypt hash de 'admin123'
  '$2a$10$8K1p/a0dL1LXMc.K0Fy3hOQx0WcVQ7vYzI9CrA4mKVBVz1vJK0uS',
  'admin',
  true
) ON CONFLICT (email) DO NOTHING;
