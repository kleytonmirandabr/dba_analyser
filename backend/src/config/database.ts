import { DataSource } from 'typeorm';
import { User } from '../entities/user.entity';
import { Connection } from '../entities/connection.entity';
import { ExecutionRequest } from '../entities/execution-request.entity';
import { AuditLog } from '../entities/audit-log.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: process.env.NODE_ENV === 'development', // Auto-sync in dev only
  logging: process.env.NODE_ENV === 'development' ? ['error'] : false,
  entities: [User, Connection, ExecutionRequest, AuditLog],
  migrations: ['dist/migrations/*.js'],
});
