/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string, example: admin }
 *               password: { type: string, example: "Dba@2025!Secure" }
 *     responses:
 *       200:
 *         description: Token JWT + dados do usuário
 *       401:
 *         description: Credenciais inválidas
 *
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Dados do usuário logado
 *     responses:
 *       200:
 *         description: Dados do usuário
 *   put:
 *     tags: [Auth]
 *     summary: Atualizar dados pessoais
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               phone: { type: string }
 *               preferredTimezone: { type: string }
 *               preferredLanguage: { type: string }
 *     responses:
 *       200:
 *         description: Dados atualizados
 *
 * /auth/change-password:
 *   put:
 *     tags: [Auth]
 *     summary: Alterar senha
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string }
 *     responses:
 *       200:
 *         description: Senha alterada
 *
 * /connections:
 *   get:
 *     tags: [Connections]
 *     summary: Listar conexões
 *     responses:
 *       200:
 *         description: Lista de conexões
 *   post:
 *     tags: [Connections]
 *     summary: Criar conexão
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               host: { type: string }
 *               port: { type: integer }
 *               dbType: { type: string, enum: [mssql, postgres] }
 *               databaseName: { type: string }
 *               username: { type: string }
 *               password: { type: string }
 *     responses:
 *       201:
 *         description: Conexão criada
 *
 * /connections/{id}:
 *   put:
 *     tags: [Connections]
 *     summary: Atualizar conexão
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Conexão atualizada
 *   delete:
 *     tags: [Connections]
 *     summary: Excluir conexão
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Conexão removida
 *
 * /alerts:
 *   get:
 *     tags: [Alerts]
 *     summary: Listar alertas
 *     responses:
 *       200:
 *         description: Lista de alertas configurados
 *   post:
 *     tags: [Alerts]
 *     summary: Criar alerta
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               severity: { type: string, enum: [critical, warning, info] }
 *               query: { type: string }
 *               connectionIds: { type: array, items: { type: string } }
 *               intervalSeconds: { type: integer }
 *               condition: { type: string, enum: [eq, neq, gt, lt, gte, lte] }
 *               threshold: { type: number }
 *     responses:
 *       201:
 *         description: Alerta criado
 *
 * /alerts/{id}:
 *   put:
 *     tags: [Alerts]
 *     summary: Atualizar alerta
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Alerta atualizado
 *   delete:
 *     tags: [Alerts]
 *     summary: Excluir alerta
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Alerta removido
 *
 * /alerts/analytics:
 *   get:
 *     tags: [Alerts]
 *     summary: Analytics de alertas (gráficos)
 *     parameters:
 *       - in: query
 *         name: hours
 *         schema: { type: integer, default: 24 }
 *     responses:
 *       200:
 *         description: Dados para gráficos (byDay, byConnection, heatmap, execTrend)
 *
 * /alerts/availability:
 *   get:
 *     tags: [Availability]
 *     summary: Disponibilidade/SLA por banco
 *     parameters:
 *       - in: query
 *         name: hours
 *         schema: { type: integer, default: 24 }
 *     responses:
 *       200:
 *         description: Timeline de disponibilidade por conexão
 *
 * /heartbeat/status:
 *   get:
 *     tags: [Heartbeat]
 *     summary: Status de todas as conexões (ping)
 *     responses:
 *       200:
 *         description: Array com status, responseMs, uptime de cada conexão
 *
 * /monitor/{connId}/queries:
 *   get:
 *     tags: [Monitor]
 *     summary: Queries ativas em uma conexão
 *     parameters:
 *       - in: path
 *         name: connId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lista de queries em execução
 *
 * /monitor/{connId}/kill/{pid}:
 *   post:
 *     tags: [Monitor]
 *     summary: Encerrar processo/sessão
 *     parameters:
 *       - in: path
 *         name: connId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Processo encerrado
 *
 * /notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: Listar canais de notificação
 *     responses:
 *       200:
 *         description: Lista de canais
 *   post:
 *     tags: [Notifications]
 *     summary: Criar canal de notificação
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               type: { type: string, enum: [telegram, email, webhook, slack] }
 *               config: { type: object }
 *               severity: { type: string, enum: [all, critical, warning] }
 *     responses:
 *       201:
 *         description: Canal criado
 *
 * /notifications/test:
 *   post:
 *     tags: [Notifications]
 *     summary: Enviar notificação de teste
 *     responses:
 *       200:
 *         description: Teste enviado
 *
 * /clients:
 *   get:
 *     tags: [Admin - Clients]
 *     summary: Listar clientes
 *     responses:
 *       200:
 *         description: Lista de clientes
 *   post:
 *     tags: [Admin - Clients]
 *     summary: Criar cliente
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, code, timezone, language, country]
 *             properties:
 *               name: { type: string }
 *               code: { type: string }
 *               timezone: { type: string, example: America/Sao_Paulo }
 *               language: { type: string, example: pt-BR }
 *               country: { type: string, example: BR }
 *               dateFormat: { type: string, example: DD/MM/YYYY }
 *               timeFormat: { type: string, example: "24h" }
 *               maxUsers: { type: integer }
 *               maxConnections: { type: integer }
 *     responses:
 *       201:
 *         description: Cliente criado
 *
 * /profiles:
 *   get:
 *     tags: [Admin - Profiles]
 *     summary: Listar perfis
 *     responses:
 *       200:
 *         description: Lista de perfis
 *   post:
 *     tags: [Admin - Profiles]
 *     summary: Criar perfil com funcionalidades
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               features: { type: array, items: { type: string }, example: ["dashboard.view", "alerts.view"] }
 *     responses:
 *       201:
 *         description: Perfil criado
 *
 * /users:
 *   get:
 *     tags: [Admin - Users]
 *     summary: Listar usuários
 *     responses:
 *       200:
 *         description: Lista de usuários
 *   post:
 *     tags: [Admin - Users]
 *     summary: Criar usuário
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, username, password, clientId, profileId]
 *             properties:
 *               name: { type: string }
 *               username: { type: string }
 *               password: { type: string }
 *               email: { type: string }
 *               clientId: { type: string, format: uuid }
 *               profileId: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Usuário criado
 *
 * /features:
 *   get:
 *     tags: [Admin - Features]
 *     summary: Listar funcionalidades (read-only)
 *     responses:
 *       200:
 *         description: Features agrupadas por módulo
 *
 * /growth/{connectionId}:
 *   get:
 *     tags: [Growth]
 *     summary: Dados de crescimento de uma conexão
 *     parameters:
 *       - in: path
 *         name: connectionId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Snapshots de crescimento
 *
 * /query/execute:
 *   post:
 *     tags: [Query]
 *     summary: Executar query SQL
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               connectionId: { type: string }
 *               query: { type: string }
 *               database: { type: string }
 *     responses:
 *       200:
 *         description: Resultado da query
 */

// This file only contains JSDoc annotations for swagger-jsdoc
export {};
