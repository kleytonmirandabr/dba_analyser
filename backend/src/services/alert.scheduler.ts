import { AppDataSource } from '../config/database';
import { Alert, AlertStatus } from '../entities/alert.entity';
import { AlertHistory } from '../entities/alert-history.entity';
import { Connection } from '../entities/connection.entity';
import { getConnCredentials } from '../utils/credentials';
import { createAdapter } from '../adapters/adapter.factory';
import { Server as SocketIO } from 'socket.io';

const FORBIDDEN_KEYWORDS = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE', 'GRANT', 'REVOKE', 'EXEC'];

let io: SocketIO | null = null;
const timers: Map<string, NodeJS.Timeout> = new Map();

export function initAlertScheduler(socketIo: SocketIO) {
  io = socketIo;
  console.log('[AlertScheduler] Initializing...');
  loadAndScheduleAll();
}

export async function loadAndScheduleAll() {
  const alertRepo = AppDataSource.getRepository(Alert);
  const alerts = await alertRepo.find({ where: { enabled: true } });
  
  // Clear existing timers
  timers.forEach(t => clearInterval(t));
  timers.clear();

  for (const alert of alerts) {
    scheduleAlert(alert);
  }
  console.log(`[AlertScheduler] Scheduled ${alerts.length} alerts`);
}

export function scheduleAlert(alert: Alert) {
  if (timers.has(alert.id)) {
    clearInterval(timers.get(alert.id)!);
  }

  const interval = Math.max(alert.intervalSeconds, 30) * 1000; // min 30s
  
  // Run immediately once, then on interval
  setTimeout(() => runAlertCheck(alert.id), 5000);
  const timer = setInterval(() => runAlertCheck(alert.id), interval);
  timers.set(alert.id, timer);
}

export function unscheduleAlert(alertId: string) {
  if (timers.has(alertId)) {
    clearInterval(timers.get(alertId)!);
    timers.delete(alertId);
  }
}

export function validateAlertQuery(sql: string): { valid: boolean; error?: string } {
  const upper = sql.toUpperCase().replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const keyword of FORBIDDEN_KEYWORDS) {
    // Check for keyword as a standalone word (not in a string)
    const regex = new RegExp(`\\b${keyword}\\b`);
    if (regex.test(upper)) {
      return { valid: false, error: `Query contém operação proibida: ${keyword}. Apenas SELECT é permitido.` };
    }
  }
  if (!upper.trim().startsWith('SELECT')) {
    return { valid: false, error: 'Query deve começar com SELECT' };
  }
  return { valid: true };
}

async function runAlertCheck(alertId: string) {
  const alertRepo = AppDataSource.getRepository(Alert);
  const historyRepo = AppDataSource.getRepository(AlertHistory);
  const connRepo = AppDataSource.getRepository(Connection);

  const alert = await alertRepo.findOne({ where: { id: alertId } });
  if (!alert || !alert.enabled) {
    unscheduleAlert(alertId);
    return;
  }

  // Determine which connections to check
  const connIds = alert.connectionIds && alert.connectionIds.length > 0
    ? alert.connectionIds
    : [alert.connectionId];

  const connections = await connRepo.findByIds(connIds);
  if (connections.length === 0) {
    await updateAlertStatus(alert, 'error', 'Nenhuma conexão encontrada');
    return;
  }

  // Run on all connections, aggregate results
  let worstStatus: AlertStatus = 'ok';
  let messages: string[] = [];

  for (const conn of connections) {
    const result = await runAlertOnConnection(alert, conn, historyRepo);
    if (result.status === 'triggered' && worstStatus !== 'error') worstStatus = 'triggered';
    if (result.status === 'error' && worstStatus === 'ok') worstStatus = 'error';
    messages.push(`[${conn.name}] ${result.message}`);
  }

  // Update overall status
  const finalMessage = connections.length === 1 ? messages[0].replace(/^[.*?] /, '') : messages.join(' | ');
  await updateAlertStatus(alert, worstStatus, finalMessage);

  if (worstStatus === 'triggered' && io) {
    io.emit('alert:triggered', {
      alertId: alert.id, name: alert.name, severity: alert.severity,
      message: finalMessage, timestamp: new Date().toISOString(),
    });
  }
}

async function runAlertOnConnection(alert: Alert, conn: Connection, historyRepo: any): Promise<{ status: AlertStatus; message: string }> {

  const start = Date.now();
  let adapter: any = null;

  try {
    adapter = createAdapter(conn.dbType);
    await adapter.connect({
      host: conn.host, port: conn.port,
      database: conn.databaseName || (conn.dbType === 'postgresql' ? 'postgres' : 'master'),
      ...getConnCredentials(conn), timeoutMs: 10000,
    });

    const result = await adapter.executeSQL(alert.query);
    const executionMs = Date.now() - start;

    if (!result.success) {
      await saveHistory(historyRepo, alert, 'error', null, executionMs, `[${conn.name}] Erro: ${result.error}`);
      return { status: 'error' as AlertStatus, message: `Erro: ${result.error}` };
    }

    const { status, message, value } = evaluateResult(alert, result);
    await saveHistory(historyRepo, alert, status, value, executionMs, `[${conn.name}] ${message}`);
    return { status, message };

  } catch (err: any) {
    const executionMs = Date.now() - start;
    await saveHistory(historyRepo, alert, 'error', null, executionMs, `[${conn.name}] ${err.message}`);
    return { status: 'error' as AlertStatus, message: err.message };
  } finally {
    if (adapter) try { await adapter.disconnect(); } catch {}
  }
}

function evaluateResult(alert: Alert, result: { rows?: any[]; rowsAffected?: number }): { status: AlertStatus; message: string; value: string } {
  const rows = result.rows || [];
  const rowCount = rows.length;

  switch (alert.evaluationType) {
    case 'has_rows':
      if (rowCount === 0) {
        return { status: 'triggered', message: `Esperava linhas mas retornou 0`, value: '0' };
      }
      return { status: 'ok', message: `OK — ${rowCount} linhas retornadas`, value: String(rowCount) };

    case 'no_rows':
      if (rowCount > 0) {
        return { status: 'triggered', message: `Esperava 0 linhas mas retornou ${rowCount}`, value: String(rowCount) };
      }
      return { status: 'ok', message: 'OK — 0 linhas (esperado)', value: '0' };

    case 'row_count': {
      const threshold = parseFloat(alert.threshold || '0');
      const triggered = compareValues(rowCount, alert.operator!, threshold);
      return {
        status: triggered ? 'triggered' : 'ok',
        message: triggered ? `Row count ${rowCount} ${alert.operator} ${threshold}` : `OK — ${rowCount} linhas`,
        value: String(rowCount)
      };
    }

    case 'scalar_value':
    case 'threshold': {
      const scalarValue = rows[0] ? Object.values(rows[0])[0] : null;
      const numValue = parseFloat(String(scalarValue));
      const threshold = parseFloat(alert.threshold || '0');
      const triggered = compareValues(numValue, alert.operator!, threshold);
      return {
        status: triggered ? 'triggered' : 'ok',
        message: triggered ? `Valor ${scalarValue} ${alert.operator} ${threshold} — ALERTA` : `OK — valor: ${scalarValue}`,
        value: String(scalarValue)
      };
    }

    default:
      return { status: 'ok', message: 'Tipo de avaliação desconhecido', value: '' };
  }
}

function compareValues(actual: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case '>': return actual > threshold;
    case '<': return actual < threshold;
    case '=': return actual === threshold;
    case '!=': return actual !== threshold;
    case '>=': return actual >= threshold;
    case '<=': return actual <= threshold;
    default: return false;
  }
}

async function saveHistory(repo: any, alert: Alert, status: AlertStatus, value: string | null, executionMs: number, message: string) {
  const entry = repo.create({ alertId: alert.id, status, value, executionMs, message });
  await repo.save(entry);
}

async function updateAlertStatus(alert: Alert, status: AlertStatus, message: string) {
  const alertRepo = AppDataSource.getRepository(Alert);
  alert.currentStatus = status;
  alert.lastMessage = message;
  alert.lastCheckedAt = new Date();
  if (status === 'triggered') alert.lastTriggeredAt = new Date();
  await alertRepo.save(alert);
}
