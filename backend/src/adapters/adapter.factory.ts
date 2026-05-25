import { DatabaseAdapter } from './base.adapter';
import { PostgresAdapter } from './postgres.adapter';
import { MSSQLAdapter } from './mssql.adapter';
import { MySQLAdapter } from './mysql.adapter';

export function createAdapter(dbType: string): DatabaseAdapter {
  switch (dbType) {
    case 'postgresql': return new PostgresAdapter();
    case 'mssql': return new MSSQLAdapter();
    case 'mysql': return new MySQLAdapter();
    default: throw new Error(`Unsupported database type: ${dbType}`);
  }
}
