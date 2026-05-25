-- Migration v0.2.0 → v0.3.0
-- Adicionar campos caso necessário em futuras versões
-- (v0.4.0 não requer migrations adicionais pois usamos synchronize em dev)

-- Exemplo de migration futura:
-- ALTER TABLE connections ADD COLUMN IF NOT EXISTS "sslEnabled" BOOLEAN DEFAULT false;
-- ALTER TABLE connections ADD COLUMN IF NOT EXISTS "sshTunnel" JSONB;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS "avatar" VARCHAR(500);
