import { decrypt } from '../config/encryption';
import { Connection } from '../entities/connection.entity';

export interface ConnectionCredentials {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  timeoutMs?: number;
}

export function getConnCredentials(conn: Connection, timeoutMs?: number): ConnectionCredentials {
  return {
    host: conn.host,
    port: conn.port,
    database: conn.databaseName,
    username: decrypt(conn.usernameEncrypted, conn.usernameSalt),
    password: decrypt(conn.passwordEncrypted, conn.passwordSalt),
    timeoutMs: timeoutMs || conn.queryTimeoutMs || 30000,
  };
}
