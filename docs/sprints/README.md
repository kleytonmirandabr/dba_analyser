# Sprints - DBA Analyser

## Histórico

| Versão | Data | Sprint | Status |
|--------|------|--------|--------|
| v2.4.0 | 2026-05-27 | minha-conta-heartbeat-notifications | ✅ Concluído |
| v2.2.0 | 2026-05-27 | perfilusuario | ✅ Concluído |
| v2.1.0 | 2026-05-26 | alertas-analytics-dashboard | ✅ Concluído |
| v2.0.0 | 2026-05-25 | core-features | ✅ Concluído |

## Versão Atual: v2.4.0

### Changelog v2.4.0
- Minha Conta: alterar nome, email, telefone, timezone pessoal, idioma, senha
- Sidebar condicional: menus baseados em hasFeature() do perfil
- Heartbeat: ping em todas as conexões (response time, uptime, sessões ativas)
- Notificações: Telegram, Email, Webhook, Slack (auto-dispara ao alertar)
- Toolbar: collapse sidebar, dropdown de admin (engrenagem), dropdown do usuário
- Versão exibida no rodapé do sidebar

### Funcionalidades completas:
- Dashboard com widgets DBA
- Conexões (SQL Server + PostgreSQL via VPN)
- Query Editor (SSMS-like, drag-and-drop, multi-tab)
- Monitor (sessões, locks, kill)
- Alertas (Zabbix-style, analytics, incidentes)
- Disponibilidade (SLA/uptime)
- Heartbeat (ping de conexões)
- Health Monitor (tabelas, índices, queries lentas)
- Crescimento de dados
- Backup monitoring
- ER Diagram
- Diagnóstico
- AI Advisor
- Comparador de schemas
- Versionamento de schemas
- VPN integrada
- Notificações (Telegram/Email/Webhook/Slack)
- Sistema de Permissões (Clientes, Perfis, Funcionalidades, Audit)
- Multi-tenant com timezone/language por cliente
- Soft delete + Audit trail completo
- Minha Conta (self-service)

### Próximas demandas possíveis:
- [ ] Export PDF de relatórios
- [ ] MTTR tracking (tempo de resolução)
- [ ] Dashboard customizável por usuário
- [ ] Integração com PagerDuty/OpsGenie
- [ ] Backup automático de configurações
- [ ] API pública documentada (Swagger)
- [ ] Mobile responsivo
- [ ] 2FA (autenticação em dois fatores)
