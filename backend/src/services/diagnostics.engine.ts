import { DatabaseAdapter } from '../adapters/base.adapter';

export interface Diagnostic {
  severity: 'critical' | 'warning' | 'info';
  category: string;
  symptom: string;
  cause: string;
  action: string;
  sql?: string;
  impact: number; // 1-10
  metric?: string;
  value?: number;
  threshold?: number;
}

export interface DiagnosticReport {
  score: number;
  diagnostics: Diagnostic[];
  metrics: Record<string, any>;
  collectedAt: string;
}

export async function runDiagnostics(adapter: DatabaseAdapter, dbType: string): Promise<DiagnosticReport> {
  const diagnostics: Diagnostic[] = [];
  const metrics: Record<string, any> = {};

  if (dbType === 'mssql') {
    await collectMssqlDiagnostics(adapter, diagnostics, metrics);
  } else if (dbType === 'postgresql') {
    await collectPgDiagnostics(adapter, diagnostics, metrics);
  }

  // Calculate score (100 - penalties)
  let score = 100;
  for (const d of diagnostics) {
    if (d.severity === 'critical') score -= d.impact * 3;
    else if (d.severity === 'warning') score -= d.impact * 1.5;
    else score -= d.impact * 0.5;
  }
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Sort by impact desc
  diagnostics.sort((a, b) => {
    const sevOrder = { critical: 0, warning: 1, info: 2 };
    if (sevOrder[a.severity] !== sevOrder[b.severity]) return sevOrder[a.severity] - sevOrder[b.severity];
    return b.impact - a.impact;
  });

  return { score, diagnostics, metrics, collectedAt: new Date().toISOString() };
}

async function query(adapter: any, sql: string): Promise<any[]> {
  // Access the internal query method
  if (adapter.query) return adapter.query(sql);
  if (adapter.pool) {
    const result = await adapter.pool.request().query(sql);
    return result.recordset;
  }
  return [];
}

async function collectMssqlDiagnostics(adapter: any, diagnostics: Diagnostic[], metrics: Record<string, any>) {
  // 1. PLE (Page Life Expectancy)
  try {
    const ple = await query(adapter, `
      SELECT cntr_value as ple FROM sys.dm_os_performance_counters
      WHERE object_name LIKE '%Buffer Manager%' AND counter_name = 'Page life expectancy'
    `);
    const pleVal = ple[0]?.ple || 0;
    metrics.ple = pleVal;
    if (pleVal < 300) {
      diagnostics.push({ severity: 'critical', category: 'Memória', symptom: `PLE muito baixo: ${pleVal}s (ideal > 1000)`, cause: 'Buffer pool sob pressão — páginas sendo descartadas rapidamente', action: 'Investigar queries com table scan, sessões idle consumindo memória, ou aumentar RAM', impact: 9, metric: 'ple', value: pleVal, threshold: 300 });
    } else if (pleVal < 700) {
      diagnostics.push({ severity: 'warning', category: 'Memória', symptom: `PLE baixo: ${pleVal}s (ideal > 1000)`, cause: 'Buffer pool com pressão moderada', action: 'Monitorar tendência — se continuar caindo, investigar missing indexes', impact: 5, metric: 'ple', value: pleVal, threshold: 700 });
    }
  } catch {}

  // 2. CPU
  try {
    const cpu = await query(adapter, `
      SELECT TOP 1 
        SQLProcessUtilization as sqlCpu,
        100 - SystemIdle as totalCpu
      FROM (
        SELECT record.value('(./Record/SchedulerMonitorEvent/SystemHealth/ProcessUtilization)[1]','int') AS SQLProcessUtilization,
               record.value('(./Record/SchedulerMonitorEvent/SystemHealth/SystemIdle)[1]','int') AS SystemIdle
        FROM (SELECT TOP 1 CONVERT(xml, record) AS record
              FROM sys.dm_os_ring_buffers
              WHERE ring_buffer_type = N'RING_BUFFER_SCHEDULER_MONITOR' ORDER BY timestamp DESC) AS x
      ) AS y
    `);
    const sqlCpu = cpu[0]?.sqlCpu || 0;
    const totalCpu = cpu[0]?.totalCpu || 0;
    metrics.cpuSql = sqlCpu;
    metrics.cpuTotal = totalCpu;
    if (sqlCpu > 85) {
      diagnostics.push({ severity: 'critical', category: 'CPU', symptom: `CPU SQL Server: ${sqlCpu}% (crítico > 85%)`, cause: 'Queries pesadas, paralelismo excessivo, ou falta de índices', action: 'Verificar top consumers e missing indexes abaixo', impact: 8, metric: 'cpuSql', value: sqlCpu, threshold: 85 });
    } else if (sqlCpu > 70) {
      diagnostics.push({ severity: 'warning', category: 'CPU', symptom: `CPU SQL Server: ${sqlCpu}% (atenção > 70%)`, cause: 'Carga elevada — pode ser normal em horário de pico', action: 'Verificar se há queries sem índice ou MAXDOP inadequado', impact: 5, metric: 'cpuSql', value: sqlCpu, threshold: 70 });
    }
  } catch {}

  // 3. Missing Indexes (GOLD — mostra exatamente o que criar)
  try {
    const missing = await query(adapter, `
      SELECT TOP 10
        CONVERT(decimal(18,2), migs.avg_user_impact * migs.user_seeks) as impact_score,
        mid.statement as table_name,
        mid.equality_columns,
        mid.inequality_columns,
        mid.included_columns,
        migs.user_seeks,
        migs.avg_user_impact,
        'CREATE INDEX IX_' + REPLACE(REPLACE(REPLACE(PARSENAME(mid.statement, 1), '[', ''), ']', ''), ' ', '') + '_' + CAST(mid.index_handle as varchar)
          + ' ON ' + mid.statement 
          + ' (' + ISNULL(mid.equality_columns, '') + CASE WHEN mid.equality_columns IS NOT NULL AND mid.inequality_columns IS NOT NULL THEN ', ' ELSE '' END + ISNULL(mid.inequality_columns, '') + ')'
          + CASE WHEN mid.included_columns IS NOT NULL THEN ' INCLUDE (' + mid.included_columns + ')' ELSE '' END as create_sql
      FROM sys.dm_db_missing_index_group_stats migs
      JOIN sys.dm_db_missing_index_groups mig ON migs.group_handle = mig.index_group_handle
      JOIN sys.dm_db_missing_index_details mid ON mig.index_handle = mid.index_handle
      WHERE mid.database_id = DB_ID()
      ORDER BY impact_score DESC
    `);
    metrics.missingIndexes = missing.length;
    if (missing.length > 0) {
      const top = missing[0];
      const severity = top.impact_score > 10000 ? 'critical' : missing.length > 5 ? 'warning' : 'info';
      diagnostics.push({
        severity, category: 'Índices',
        symptom: `${missing.length} índice(s) sugeridos pelo optimizer (impacto: ${Math.round(top.impact_score)})`,
        cause: `Queries fazendo scan em tabelas sem índice adequado. Top: ${top.table_name}`,
        action: `Criar índice mais impactante:`,
        sql: top.create_sql,
        impact: severity === 'critical' ? 8 : severity === 'warning' ? 5 : 3,
      });
      if (missing.length > 1) {
        metrics.missingIndexDetails = missing.slice(0, 5).map((m: any) => ({
          table: m.table_name, impact: Math.round(m.impact_score), sql: m.create_sql
        }));
      }
    }
  } catch {}

  // 4. TempDB
  try {
    const tempdb = await query(adapter, `
      SELECT 
        SUM(unallocated_extent_page_count) * 8.0 / 1024 as freeMB,
        SUM(total_page_count) * 8.0 / 1024 as totalMB
      FROM tempdb.sys.dm_db_file_space_usage
    `);
    const freeMB = tempdb[0]?.freeMB || 0;
    const totalMB = tempdb[0]?.totalMB || 1;
    const freePct = (freeMB / totalMB) * 100;
    metrics.tempdbFreePct = Math.round(freePct);
    metrics.tempdbTotalMB = Math.round(totalMB);
    if (freePct < 10) {
      diagnostics.push({ severity: 'critical', category: 'TempDB', symptom: `TempDB ${Math.round(freePct)}% livre (${Math.round(freeMB)}MB de ${Math.round(totalMB)}MB)`, cause: 'Sorts, spills, version store ou objetos temporários consumindo TempDB', action: 'Identificar sessões com uso excessivo de TempDB e otimizar queries com ORDER BY/GROUP BY', impact: 8, metric: 'tempdbFreePct', value: Math.round(freePct), threshold: 10 });
    } else if (freePct < 25) {
      diagnostics.push({ severity: 'warning', category: 'TempDB', symptom: `TempDB ${Math.round(freePct)}% livre`, cause: 'Uso moderado — monitorar tendência', action: 'Verificar version store e queries com spills', impact: 4 });
    }
  } catch {}

  // 5. IO Latency
  try {
    const io = await query(adapter, `
      SELECT
        AVG(CASE WHEN num_of_reads > 0 THEN io_stall_read_ms / num_of_reads ELSE 0 END) as avgReadMs,
        AVG(CASE WHEN num_of_writes > 0 THEN io_stall_write_ms / num_of_writes ELSE 0 END) as avgWriteMs
      FROM sys.dm_io_virtual_file_stats(DB_ID(), NULL)
    `);
    const readMs = Math.round(io[0]?.avgReadMs || 0);
    const writeMs = Math.round(io[0]?.avgWriteMs || 0);
    metrics.ioReadMs = readMs;
    metrics.ioWriteMs = writeMs;
    if (readMs > 50) {
      diagnostics.push({ severity: 'critical', category: 'IO', symptom: `Latência de leitura: ${readMs}ms (ideal < 20ms)`, cause: 'Disco lento, fila de IO, ou queries fazendo leituras excessivas (table scan)', action: 'Verificar missing indexes (reduz leituras) ou mover arquivos para disco mais rápido', impact: 7 });
    } else if (readMs > 20) {
      diagnostics.push({ severity: 'warning', category: 'IO', symptom: `Latência de leitura: ${readMs}ms (atenção > 20ms)`, cause: 'IO moderadamente lento', action: 'Monitorar — se correlaciona com missing indexes, resolver índices primeiro', impact: 4 });
    }
  } catch {}

  // 6. Wait Stats analysis
  try {
    const waits = await query(adapter, `
      SELECT TOP 5 wait_type, wait_time_ms, waiting_tasks_count,
        CAST(wait_time_ms * 100.0 / SUM(wait_time_ms) OVER() as decimal(5,2)) as pct
      FROM sys.dm_os_wait_stats
      WHERE wait_type NOT IN ('WAITFOR','LAZYWRITER_SLEEP','SQLTRACE_BUFFER_FLUSH','CLR_AUTO_EVENT','CLR_MANUAL_EVENT','REQUEST_FOR_DEADLOCK_SEARCH','SLEEP_TASK','BROKER_TO_FLUSH','CHECKPOINT_QUEUE','FT_IFTS_SCHEDULER_IDLE_WAIT','XE_DISPATCHER_WAIT','HADR_FILESTREAM_IOMGR_IOCOMPLETION','SP_SERVER_DIAGNOSTICS_SLEEP','DIRTY_PAGE_POLL','BROKER_EVENTHANDLER')
      AND wait_time_ms > 0
      ORDER BY wait_time_ms DESC
    `);
    metrics.topWaits = waits;
    const pageio = waits.find((w: any) => w.wait_type === 'PAGEIOLATCH_SH' || w.wait_type === 'PAGEIOLATCH_EX');
    if (pageio && pageio.pct > 30) {
      diagnostics.push({ severity: 'warning', category: 'Waits', symptom: `PAGEIOLATCH = ${pageio.pct}% dos waits`, cause: 'Dados sendo lidos do disco (não do buffer) — memória insuficiente ou missing indexes', action: 'Correlacionar com PLE e missing indexes — criar índices reduz leituras de disco', impact: 6 });
    }
    const cxpacket = waits.find((w: any) => w.wait_type === 'CXPACKET' || w.wait_type === 'CXCONSUMER');
    if (cxpacket && cxpacket.pct > 25) {
      diagnostics.push({ severity: 'warning', category: 'Paralelismo', symptom: `CXPACKET/CXCONSUMER = ${cxpacket.pct}% dos waits`, cause: 'Paralelismo excessivo — MAXDOP pode estar muito alto', action: 'Configurar MAXDOP = metade dos cores (max 8) e Cost Threshold = 50',
        sql: "EXEC sp_configure 'max degree of parallelism', 4; EXEC sp_configure 'cost threshold for parallelism', 50; RECONFIGURE;", impact: 4 });
    }
    const lck = waits.find((w: any) => w.wait_type.startsWith('LCK_'));
    if (lck && lck.pct > 15) {
      diagnostics.push({ severity: 'warning', category: 'Locks', symptom: `Lock waits = ${lck.pct}% (${lck.wait_type})`, cause: 'Contenção de bloqueios — transações longas ou escalação de lock', action: 'Verificar queries com transações abertas e considerar RCSI', impact: 5 });
    }
  } catch {}

  // 7. Connections / Sessions
  try {
    const sess = await query(adapter, `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'sleeping' AND last_request_end_time < DATEADD(MINUTE, -30, GETDATE()) THEN 1 ELSE 0 END) as idle30min
      FROM sys.dm_exec_sessions WHERE is_user_process = 1
    `);
    metrics.totalSessions = sess[0]?.total || 0;
    metrics.activeSessions = sess[0]?.active || 0;
    metrics.idleSessions30min = sess[0]?.idle30min || 0;
    if (sess[0]?.idle30min > 50) {
      diagnostics.push({ severity: 'warning', category: 'Sessões', symptom: `${sess[0].idle30min} sessões idle há mais de 30min (de ${sess[0].total} total)`, cause: 'Connection pool do aplicativo não está reciclando conexões', action: 'Configurar idle timeout no connection pool da aplicação (ex: 5min)', impact: 4 });
    }
  } catch {}

  // 8. Transaction Log usage
  try {
    const log = await query(adapter, `
      SELECT name, CAST(FILEPROPERTY(name, 'SpaceUsed') * 100.0 / size as decimal(5,2)) as usedPct
      FROM sys.database_files WHERE type = 1
    `);
    if (log[0]) {
      metrics.logUsagePct = parseFloat(log[0].usedPct);
      if (log[0].usedPct > 90) {
        diagnostics.push({ severity: 'critical', category: 'Log', symptom: `Transaction log ${log[0].usedPct}% utilizado`, cause: 'Backup de log não está rodando, transação aberta, ou replicação atrasada', action: 'Executar BACKUP LOG ou verificar se há transações abertas bloqueando truncate', sql: `BACKUP LOG [DB_NAME] TO DISK = 'NUL'; -- Trunca o log (apenas se backup full existe)`, impact: 8 });
      } else if (log[0].usedPct > 70) {
        diagnostics.push({ severity: 'warning', category: 'Log', symptom: `Transaction log ${log[0].usedPct}% utilizado`, cause: 'Uso elevado — pode crescer se houver transação longa', action: 'Verificar frequência de backup de log e transações abertas', impact: 4 });
      }
    }
  } catch {}

  // 9. MAXDOP / Config checks
  try {
    const config = await query(adapter, `
      SELECT name, CAST(value_in_use as int) as val FROM sys.configurations 
      WHERE name IN ('max degree of parallelism', 'cost threshold for parallelism', 'max server memory (MB)')
    `);
    const maxdop = config.find((c: any) => c.name === 'max degree of parallelism');
    const cost = config.find((c: any) => c.name === 'cost threshold for parallelism');
    const maxmem = config.find((c: any) => c.name === 'max server memory (MB)');
    metrics.maxdop = maxdop?.val;
    metrics.costThreshold = cost?.val;
    metrics.maxMemoryMB = maxmem?.val;

    if (maxdop && maxdop.val === 0) {
      diagnostics.push({ severity: 'info', category: 'Configuração', symptom: 'MAXDOP = 0 (usa todos os cores)', cause: 'Pode causar CXPACKET excessivo em servers com muitos cores', action: 'Configurar MAXDOP = 4-8 para workloads OLTP',
        sql: "EXEC sp_configure 'max degree of parallelism', 4; RECONFIGURE;", impact: 3 });
    }
    if (cost && cost.val === 5) {
      diagnostics.push({ severity: 'info', category: 'Configuração', symptom: 'Cost Threshold = 5 (padrão muito baixo)', cause: 'Queries simples entram em paralelismo desnecessariamente', action: 'Aumentar para 50 em workloads OLTP',
        sql: "EXEC sp_configure 'cost threshold for parallelism', 50; RECONFIGURE;", impact: 2 });
    }
    if (maxmem && maxmem.val > 2000000) {
      diagnostics.push({ severity: 'info', category: 'Configuração', symptom: `Max Memory = ${Math.round(maxmem.val / 1024)}GB (pode ser o padrão ilimitado)`, cause: 'SQL Server pode consumir toda a RAM do SO', action: 'Limitar a 80-90% da RAM total do servidor',
        sql: `EXEC sp_configure 'max server memory', ${Math.round(maxmem.val * 0.85)}; RECONFIGURE;`, impact: 3 });
    }
  } catch {}
}

async function collectPgDiagnostics(adapter: any, diagnostics: Diagnostic[], metrics: Record<string, any>) {
  // PostgreSQL diagnostics
  try {
    const hits = await query(adapter, `
      SELECT sum(blks_hit) as hit, sum(blks_read) as read 
      FROM pg_stat_database WHERE datname = current_database()
    `);
    if (hits[0]) {
      const ratio = hits[0].hit / (hits[0].hit + hits[0].read + 1) * 100;
      metrics.cacheHitRatio = Math.round(ratio * 100) / 100;
      if (ratio < 95) {
        diagnostics.push({ severity: 'warning', category: 'Memória', symptom: `Cache hit ratio: ${ratio.toFixed(1)}% (ideal > 99%)`, cause: 'Muitas leituras de disco — shared_buffers pode ser insuficiente', action: 'Aumentar shared_buffers ou verificar queries sem índice', impact: 6 });
      }
    }
  } catch {}

  try {
    const deadTuples = await query(adapter, `
      SELECT schemaname || '.' || relname as table, n_dead_tup, n_live_tup,
        ROUND(n_dead_tup::numeric / GREATEST(n_live_tup, 1) * 100, 1) as dead_pct
      FROM pg_stat_user_tables WHERE n_dead_tup > 10000
      ORDER BY n_dead_tup DESC LIMIT 5
    `);
    if (deadTuples.length > 0 && parseFloat(deadTuples[0].dead_pct) > 20) {
      diagnostics.push({ severity: 'warning', category: 'Vacuum', symptom: `Tabela ${deadTuples[0].table} com ${deadTuples[0].dead_pct}% dead tuples`, cause: 'Autovacuum não está conseguindo limpar — muitas atualizações ou delete', action: 'Rodar VACUUM ANALYZE manualmente ou ajustar autovacuum_scale_factor',
        sql: `VACUUM ANALYZE ${deadTuples[0].table};`, impact: 5 });
    }
  } catch {}

  try {
    const unused = await query(adapter, `
      SELECT schemaname || '.' || indexrelname as index, pg_relation_size(indexrelid) as size_bytes
      FROM pg_stat_user_indexes WHERE idx_scan = 0 AND pg_relation_size(indexrelid) > 1048576
      ORDER BY pg_relation_size(indexrelid) DESC LIMIT 5
    `);
    if (unused.length > 0) {
      const totalMB = unused.reduce((a: number, i: any) => a + i.size_bytes, 0) / 1024 / 1024;
      diagnostics.push({ severity: 'info', category: 'Índices', symptom: `${unused.length} índices nunca usados (${Math.round(totalMB)}MB desperdício)`, cause: 'Índices criados mas nenhuma query os utiliza', action: 'Considerar remover para reduzir overhead de write',
        sql: unused.map((i: any) => `-- DROP INDEX ${i.index}; -- ${Math.round(i.size_bytes/1024/1024)}MB`).join('\n'), impact: 2 });
    }
  } catch {}
}
