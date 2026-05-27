import { EntitySubscriberInterface, InsertEvent, UpdateEvent, RemoveEvent, EventSubscriber } from 'typeorm';
import { AppDataSource } from '../config/database';

// This table stores all changes
const AUDIT_TABLE = 'audit_logs_v2';

// Tables to skip auditing (to avoid infinite loops)
const SKIP_TABLES = ['audit_logs', 'user_activity_logs', 'alert_history', 'features'];

@EventSubscriber()
export class AuditSubscriber implements EntitySubscriberInterface {

  /**
   * Called after entity insertion.
   */
  afterInsert(event: InsertEvent<any>) {
    if (!event.metadata?.tableName || SKIP_TABLES.includes(event.metadata.tableName)) return;
    this.logAction(event.metadata.tableName, event.entity?.id, 'create', event.entity, null, event.entity);
  }

  /**
   * Called after entity update.
   */
  afterUpdate(event: UpdateEvent<any>) {
    if (!event.metadata?.tableName || SKIP_TABLES.includes(event.metadata.tableName)) return;
    const changes: Record<string, { old: any; new: any }> = {};
    if (event.updatedColumns) {
      for (const col of event.updatedColumns) {
        const prop = col.propertyName;
        const oldVal = event.databaseEntity?.[prop];
        const newVal = event.entity?.[prop];
        if (oldVal !== newVal) {
          changes[prop] = { old: oldVal, new: newVal };
        }
      }
    }
    if (Object.keys(changes).length > 0) {
      this.logAction(event.metadata.tableName, event.entity?.id || event.databaseEntity?.id, 'update', event.entity, changes, null);
    }
  }

  /**
   * Called after soft remove.
   */
  afterSoftRemove(event: RemoveEvent<any>) {
    if (!event.metadata?.tableName || SKIP_TABLES.includes(event.metadata.tableName)) return;
    this.logAction(event.metadata.tableName, event.entity?.id || event.databaseEntity?.id, 'delete', event.entity, null, null);
  }

  private async logAction(tableName: string, recordId: string, action: string, entity: any, changes: any, fullEntity: any) {
    try {
      await AppDataSource.query(
        `INSERT INTO ${AUDIT_TABLE} (id, "tableName", "recordId", action, "userId", "userName", "clientId", changes, metadata, timestamp)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          tableName,
          recordId || null,
          action,
          entity?.updatedById || entity?.createdById || entity?.deletedById || null,
          null, // userName filled by middleware context if available
          entity?.clientId || null,
          JSON.stringify(changes || fullEntity || {}),
          JSON.stringify({}),
        ]
      );
    } catch (e) {
      // Don't crash the app if audit fails
      console.error('[AuditSubscriber] Error logging:', e);
    }
  }
}
