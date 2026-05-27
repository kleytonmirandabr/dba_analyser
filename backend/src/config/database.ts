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
import { BackupJob } from '../entities/backup-job.entity';
import { SchemaSnapshot } from '../entities/schema-snapshot.entity';
import { Client } from '../entities/client.entity';
import { Feature } from '../entities/feature.entity';
import { Profile } from '../entities/profile.entity';
import { ProfileFeature } from '../entities/profile-feature.entity';
import { UserActivityLog } from '../entities/user-activity-log.entity';
import { AuditLogV2 } from '../entities/audit-log-v2.entity';
import { AuditSubscriber } from '../subscribers/audit.subscriber';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: process.env.NODE_ENV === 'development', // Auto-sync in dev only
  logging: process.env.NODE_ENV === 'development' ? ['error'] : false,
  entities: [User, Connection, ExecutionRequest, AuditLog, Alert, AlertHistory, TableSnapshot,
    QueryAdvice,
    ReportSchedule, TableGrowthRule, HealthSnapshot, BackupJob, SchemaSnapshot,
    Client, Feature, Profile, ProfileFeature, UserActivityLog, AuditLogV2],
  subscribers: [AuditSubscriber],
  migrations: ['dist/migrations/*.js'],
});
