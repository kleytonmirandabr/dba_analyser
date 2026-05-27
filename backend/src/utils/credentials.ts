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
  let username: string;
  let password: string;
  
  try {
    username = decrypt(conn.usernameEncrypted, conn.usernameSalt);
  } catch (e) {
    throw new Error(`Não foi possível decriptar as credenciais da conexão "${conn.name}". A DBA_MASTER_KEY pode ter sido alterada. Edite a conexão e salve novamente o usuário/senha.`);
  }
  
  try {
    password = decrypt(conn.passwordEncrypted, conn.passwordSalt);
  } catch (e) {
    throw new Error(`Não foi possível decriptar a senha da conexão "${conn.name}". A DBA_MASTER_KEY pode ter sido alterada. Edite a conexão e salve novamente o usuário/senha.`);
  }

  return {
    host: conn.host,
    port: conn.port,
    database: conn.databaseName,
    username,
    password,
    timeoutMs: timeoutMs || conn.queryTimeoutMs || 30000,
  };
}
