import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'DBA Analyser API',
      version: '2.5.0',
      description: `API completa do DBA Analyser para monitoramento e administração de bancos de dados.

## Autenticação
Todas as rotas (exceto login) requerem token JWT no header:
\`Authorization: Bearer <token>\`

## Módulos
- **Auth** — Login, logout, alterar senha, dados pessoais
- **Connections** — Gerenciar conexões de banco
- **Query** — Executar queries
- **Monitor** — Sessões ativas, kill
- **Alerts** — Regras de alerta, histórico, analytics
- **Health** — Health monitor (tabelas, índices)
- **Heartbeat** — Ping de conexões
- **Availability** — SLA/Uptime
- **Growth** — Crescimento de dados
- **Backup** — Monitoramento de backups
- **Notifications** — Canais de notificação
- **Clients** — Gestão de clientes (multi-tenant)
- **Profiles** — Perfis de acesso
- **Users** — Gestão de usuários
- **Features** — Funcionalidades do sistema (read-only)
`,
      contact: { name: 'DBA Analyser', email: 'suporte@dbaanalyser.com' },
      license: { name: 'Proprietary' },
    },
    servers: [{ url: '/api', description: 'API Server' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
