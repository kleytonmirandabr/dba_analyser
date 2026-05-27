import { AppDataSource } from '../config/database';
import { Feature } from '../entities/feature.entity';

const FEATURES = [
  // Dashboard
  { code: 'dashboard.view', name: 'Visualizar Dashboard', module: 'Dashboard', moduleOrder: 1, featureOrder: 1, description: 'Permite visualizar o dashboard principal com resumo geral do ambiente' },

  // Conexões
  { code: 'connections.view', name: 'Visualizar Conexões', module: 'Conexões', moduleOrder: 2, featureOrder: 1, description: 'Permite ver a lista de conexões de banco configuradas' },
  { code: 'connections.manage', name: 'Gerenciar Conexões', module: 'Conexões', moduleOrder: 2, featureOrder: 2, description: 'Permite criar, editar e remover conexões de banco' },
  { code: 'connections.test', name: 'Testar Conexão', module: 'Conexões', moduleOrder: 2, featureOrder: 3, description: 'Permite testar conectividade com o banco de dados' },

  // Query
  { code: 'query.execute', name: 'Executar Queries', module: 'Query', moduleOrder: 3, featureOrder: 1, description: 'Permite executar comandos SELECT no editor de queries' },
  { code: 'query.write', name: 'Executar Escrita', module: 'Query', moduleOrder: 3, featureOrder: 2, description: 'Permite executar INSERT, UPDATE, DELETE e DDL' },
  { code: 'query.export', name: 'Exportar Resultados', module: 'Query', moduleOrder: 3, featureOrder: 3, description: 'Permite exportar resultados em CSV, Excel, JSON' },
  { code: 'query.history', name: 'Ver Histórico', module: 'Query', moduleOrder: 3, featureOrder: 4, description: 'Permite visualizar histórico de queries executadas' },

  // Monitor
  { code: 'monitor.view', name: 'Visualizar Monitor', module: 'Monitor', moduleOrder: 4, featureOrder: 1, description: 'Permite visualizar sessões ativas, locks e estatísticas' },
  { code: 'monitor.kill', name: 'Encerrar Sessões', module: 'Monitor', moduleOrder: 4, featureOrder: 2, description: 'Permite encerrar (KILL) processos/sessões no banco' },

  // Alertas
  { code: 'alerts.view', name: 'Visualizar Alertas', module: 'Alertas', moduleOrder: 5, featureOrder: 1, description: 'Permite visualizar alertas configurados e incidentes' },
  { code: 'alerts.manage', name: 'Gerenciar Alertas', module: 'Alertas', moduleOrder: 5, featureOrder: 2, description: 'Permite criar e editar regras de alerta' },
  { code: 'alerts.delete', name: 'Excluir Alertas', module: 'Alertas', moduleOrder: 5, featureOrder: 3, description: 'Permite excluir alertas' },
  { code: 'alerts.test', name: 'Testar Alerta', module: 'Alertas', moduleOrder: 5, featureOrder: 4, description: 'Permite executar teste manual de um alerta' },

  // Disponibilidade
  { code: 'availability.view', name: 'Visualizar Disponibilidade', module: 'Disponibilidade', moduleOrder: 6, featureOrder: 1, description: 'Permite visualizar o painel de SLA/uptime por banco' },

  // Health
  { code: 'health.view', name: 'Visualizar Health', module: 'Health', moduleOrder: 7, featureOrder: 1, description: 'Permite visualizar o Health Monitor (tabelas, índices, queries lentas)' },
  { code: 'health.config', name: 'Configurar Health', module: 'Health', moduleOrder: 7, featureOrder: 2, description: 'Permite alterar configurações do health monitor' },

  // Diagnóstico
  { code: 'diagnostics.view', name: 'Visualizar Diagnósticos', module: 'Diagnóstico', moduleOrder: 8, featureOrder: 1, description: 'Permite visualizar resultados de diagnósticos' },
  { code: 'diagnostics.run', name: 'Executar Diagnóstico', module: 'Diagnóstico', moduleOrder: 8, featureOrder: 2, description: 'Permite executar diagnóstico manual no banco' },

  // Backup
  { code: 'backup.view', name: 'Visualizar Backups', module: 'Backup', moduleOrder: 9, featureOrder: 1, description: 'Permite visualizar status e histórico de backups' },
  { code: 'backup.manage', name: 'Gerenciar Backups', module: 'Backup', moduleOrder: 9, featureOrder: 2, description: 'Permite configurar e executar políticas de backup' },

  // VPN
  { code: 'vpn.view', name: 'Visualizar VPN', module: 'VPN', moduleOrder: 10, featureOrder: 1, description: 'Permite visualizar status da conexão VPN' },
  { code: 'vpn.manage', name: 'Gerenciar VPN', module: 'VPN', moduleOrder: 10, featureOrder: 2, description: 'Permite conectar, desconectar e fazer upload de configuração VPN' },

  // Relatórios
  { code: 'reports.view', name: 'Visualizar Relatórios', module: 'Relatórios', moduleOrder: 11, featureOrder: 1, description: 'Permite visualizar relatórios gerados' },
  { code: 'reports.export', name: 'Exportar Relatórios', module: 'Relatórios', moduleOrder: 11, featureOrder: 2, description: 'Permite gerar e exportar relatórios em PDF/Excel' },

  // Comparador
  { code: 'comparator.view', name: 'Visualizar Comparações', module: 'Comparador', moduleOrder: 12, featureOrder: 1, description: 'Permite visualizar comparações de schema' },
  { code: 'comparator.run', name: 'Executar Comparação', module: 'Comparador', moduleOrder: 12, featureOrder: 2, description: 'Permite executar comparação entre ambientes/schemas' },

  // Crescimento
  { code: 'growth.view', name: 'Visualizar Crescimento', module: 'Crescimento', moduleOrder: 13, featureOrder: 1, description: 'Permite visualizar tendências de crescimento de dados' },
  { code: 'growth.snapshot', name: 'Forçar Snapshot', module: 'Crescimento', moduleOrder: 13, featureOrder: 2, description: 'Permite forçar coleta manual de snapshot de tamanho' },

  // ER Diagram
  { code: 'erdiagram.view', name: 'Visualizar ER Diagram', module: 'ER Diagram', moduleOrder: 14, featureOrder: 1, description: 'Permite visualizar diagramas de entidade-relacionamento' },

  // Administração
  { code: 'admin.users', name: 'Gerenciar Usuários', module: 'Administração', moduleOrder: 20, featureOrder: 1, description: 'Permite criar, editar, desativar e excluir usuários' },
  { code: 'admin.clients', name: 'Gerenciar Clientes', module: 'Administração', moduleOrder: 20, featureOrder: 2, description: 'Permite criar e gerenciar clientes (multi-tenant)' },
  { code: 'admin.profiles', name: 'Gerenciar Perfis', module: 'Administração', moduleOrder: 20, featureOrder: 3, description: 'Permite criar perfis e vincular funcionalidades' },
  { code: 'admin.audit', name: 'Visualizar Auditoria', module: 'Administração', moduleOrder: 20, featureOrder: 4, description: 'Permite visualizar logs de auditoria completos' },
  { code: 'admin.settings', name: 'Configurações Globais', module: 'Administração', moduleOrder: 20, featureOrder: 5, description: 'Permite alterar configurações globais do sistema' },
];

export async function registerFeatures() {
  const repo = AppDataSource.getRepository(Feature);

  for (const f of FEATURES) {
    const existing = await repo.findOne({ where: { code: f.code } });
    if (existing) {
      // Update name/description/order if changed
      existing.name = f.name;
      existing.description = f.description;
      existing.module = f.module;
      existing.moduleOrder = f.moduleOrder;
      existing.featureOrder = f.featureOrder;
      await repo.save(existing);
    } else {
      await repo.save(repo.create(f));
    }
  }

  console.log(`[FeatureRegistry] ${FEATURES.length} features registered`);
}

export { FEATURES };
