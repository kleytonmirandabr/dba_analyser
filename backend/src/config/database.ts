import { DataSource } from 'typeorm';
import { User } from '../entities/user.entity';
import { Connection } from '../entities/connection.entity';
import { ExecutionRequest } from '../entities/execution-request.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { Alert } from '../entities/alert.entity';
import { AlertHistory } from '../entities/alert-history.entity';
import { TableSnapshot } from '../entities/table-snapshot.entity';
import { QueryAdvice } from '../entities/query-advice.entity';
import { ReportSchedule } from '../entities/report-schedule.entity';
import { HealthSnapshot } from '../entities/health-snapshot.entity';
import { TableGrowthRule } from '../entities/table-growth-rule.entity';
import { HealthSnapshot } from '../entities/health-snapshot.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: process.env.NODE_ENV === 'development', // Auto-sync in dev only
  logging: process.env.NODE_ENV === 'development' ? ['error'] : false,
  entities: [User, Connection, ExecutionRequest, AuditLog, Alert, AlertHistory, TableSnapshot,
    QueryAdvice,
    ReportSchedule, TableGrowthRule, HealthSnapshot],
  migrations: ['dist/migrations/*.js'],
});
