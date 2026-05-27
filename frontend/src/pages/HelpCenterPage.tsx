import { useState, useMemo } from 'react';
import { HelpCircle, Search, ChevronDown, ChevronRight, ExternalLink, BookOpen, Terminal, Bell, Shield, Activity, Database, TrendingUp, Wifi, FileText, Heart } from 'lucide-react';

interface HelpSection {
  id: string; title: string; icon: any; category: string;
  articles: { title: string; content: string; keywords: string[] }[];
}

const HELP_DATA: HelpSection[] = [
  {
    id: 'getting-started', title: 'Primeiros Passos', icon: BookOpen, category: 'Geral',
    articles: [
      { title: 'Visão geral do DBA Analyser', content: 'O DBA Analyser é uma plataforma completa para monitoramento, administração e análise de bancos de dados SQL Server e PostgreSQL. Oferece query editor, monitoramento em tempo real, alertas inteligentes, heartbeat, disponibilidade (SLA), e muito mais.', keywords: ['inicio', 'overview', 'sobre'] },
      { title: 'Como fazer login', content: 'Acesse a URL do sistema e insira seu username e senha. O administrador define suas credenciais. Após login, o sistema carrega automaticamente seu perfil de permissões, timezone e idioma configurados.', keywords: ['login', 'acesso', 'senha'] },
      { title: 'Navegação e menus', content: 'O menu lateral (sidebar) mostra apenas as funcionalidades que seu perfil permite. O ícone de engrenagem ⚙️ na toolbar dá acesso à administração. Clique no seu nome para acessar "Minha Conta". Use Ctrl+K para busca global.', keywords: ['menu', 'navegacao', 'sidebar'] },
      { title: 'Timezone e idioma', content: 'O sistema armazena tudo em UTC. A exibição é convertida para o timezone do seu cliente. Você pode sobrescrever o timezone/idioma em Minha Conta. Formatos disponíveis: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD.', keywords: ['timezone', 'idioma', 'horario', 'utc'] },
    ]
  },
  {
    id: 'connections', title: 'Conexões', icon: Database, category: 'Core',
    articles: [
      { title: 'Criar uma conexão', content: 'Vá em Conexões → Novo. Preencha: nome, host, porta, tipo (SQL Server ou PostgreSQL), database, credenciais. Teste antes de salvar. Para acesso via VPN, configure primeiro o módulo VPN.', keywords: ['conexao', 'criar', 'novo', 'host', 'porta'] },
      { title: 'Conexão via VPN', content: 'Faça upload do arquivo .ovpn em VPN → Upload Config. Conecte a VPN. As conexões que passam pela VPN serão roteadas automaticamente pelo túnel.', keywords: ['vpn', 'openvpn', 'tunnel', 'tunel'] },
      { title: 'Testar conexão', content: 'Na listagem de conexões, clique em "Testar". O sistema executa um SELECT 1 e mostra o tempo de resposta. Se falhar, verifique: firewall, credenciais, VPN, porta.', keywords: ['testar', 'teste', 'ping', 'verificar'] },
      { title: 'Multi-database', content: 'Cada conexão aponta para UM database. Para monitorar vários databases do mesmo servidor, crie uma conexão por database. Use "Selecionar Databases" para criar em lote.', keywords: ['multi', 'database', 'multiplos', 'lote'] },
    ]
  },
  {
    id: 'query', title: 'Query Editor', icon: Terminal, category: 'Core',
    articles: [
      { title: 'Executar queries', content: 'Abra Query, selecione a conexão e database. Digite SQL no editor. Execute com F5 ou Ctrl+Enter. Para executar apenas a seleção, selecione o texto antes de executar.', keywords: ['query', 'executar', 'sql', 'f5', 'select'] },
      { title: 'Drag-and-drop', content: 'Arraste tabelas, colunas ou triggers do painel lateral diretamente para o editor. O nome é inserido na posição do cursor.', keywords: ['drag', 'drop', 'arrastar'] },
      { title: 'Múltiplas abas', content: 'Cada aba mostra o database selecionado. Abra quantas abas precisar (Ctrl+T). Os resultados são exibidos em tabela com paginação e export.', keywords: ['aba', 'tab', 'multiplas'] },
      { title: 'Plano de execução', content: 'Clique em "Plano Execução" para ver o plano estimado da query. Em "Analisar Performance" o sistema sugere índices e otimizações.', keywords: ['plano', 'execucao', 'performance', 'indice'] },
      { title: 'Exportar resultados', content: 'Após executar, clique em Export (CSV, JSON, Excel). Os resultados são baixados com o nome da aba como arquivo.', keywords: ['exportar', 'csv', 'excel', 'json', 'download'] },
    ]
  },
  {
    id: 'monitor', title: 'Monitor', icon: Activity, category: 'Core',
    articles: [
      { title: 'Sessões ativas', content: 'Monitor mostra todas as sessões/queries em execução no banco em tempo real. Atualiza a cada 5 segundos. Mostra: PID, duração, query, status, bloqueios.', keywords: ['sessao', 'ativa', 'processo', 'running'] },
      { title: 'Kill de processos', content: 'Clique no ícone de encerrar (❌) ao lado de um processo para executar KILL. Requer permissão monitor.kill. Use com cuidado em produção.', keywords: ['kill', 'encerrar', 'matar', 'processo'] },
      { title: 'Locks e deadlocks', content: 'A aba Locks mostra bloqueios ativos. Deadlocks são detectados automaticamente e exibidos com a cadeia de bloqueio completa.', keywords: ['lock', 'bloqueio', 'deadlock'] },
    ]
  },
  {
    id: 'alerts', title: 'Alertas', icon: Bell, category: 'Monitoramento',
    articles: [
      { title: 'Criar um alerta', content: 'Alertas → Novo Alerta. Defina: nome, severidade (critical/warning), query SQL, conexões alvo, intervalo de verificação, condição (>, <, =, !=) e threshold. O sistema executa a query periodicamente e compara o resultado.', keywords: ['alerta', 'criar', 'regra', 'threshold'] },
      { title: 'Visualização Zabbix-style', content: 'A view Dashboard agrupa problemas por regra de alerta. Mostra quantos bancos estão com problema, valores retornados, e tempo de persistência.', keywords: ['zabbix', 'dashboard', 'problemas', 'incidentes'] },
      { title: 'Analytics', content: 'A aba Analytics mostra gráficos: alertas por dia, por conexão, heatmap semanal, tendência de execuções, e ranking de bancos com mais problemas.', keywords: ['analytics', 'grafico', 'tendencia', 'heatmap'] },
      { title: 'Notificações automáticas', content: 'Configure canais em Notificações (Telegram, Email, Webhook, Slack). Quando um alerta dispara, a notificação é enviada automaticamente para os canais ativos.', keywords: ['notificacao', 'telegram', 'email', 'webhook', 'slack', 'automatico'] },
    ]
  },
  {
    id: 'heartbeat', title: 'Heartbeat', icon: Heart, category: 'Monitoramento',
    articles: [
      { title: 'Como funciona', content: 'O Heartbeat faz ping em todas as conexões ativas a cada 30 segundos. Mede: tempo de resposta (ms), uptime do servidor, sessões ativas. Status: online (verde), warning (>5s resposta), offline (falha).', keywords: ['heartbeat', 'ping', 'online', 'offline'] },
      { title: 'Detectar banco offline', content: 'Se uma conexão não responde, aparece em vermelho com a mensagem de erro. Use junto com Alertas para criar regras de notificação quando um banco cair.', keywords: ['offline', 'caiu', 'indisponivel', 'down'] },
    ]
  },
  {
    id: 'availability', title: 'Disponibilidade', icon: Heart, category: 'Monitoramento',
    articles: [
      { title: 'SLA/Uptime', content: 'A tela Disponibilidade calcula o % de tempo que cada banco esteve online baseado no histórico de alertas. Mostra timeline visual (verde/vermelho) e streak atual.', keywords: ['disponibilidade', 'sla', 'uptime', 'porcentagem'] },
      { title: 'Períodos', content: 'Filtre por: 1h, 6h, 12h, 24h, 3 dias, 7 dias, 30 dias. Quanto maior o período, mais precisa a métrica de disponibilidade.', keywords: ['periodo', 'filtro', 'historico'] },
    ]
  },
  {
    id: 'permissions', title: 'Permissões', icon: Shield, category: 'Administração',
    articles: [
      { title: 'Clientes (multi-tenant)', content: 'Cada cliente é uma organização isolada. Possui: nome, código, timezone obrigatório, idioma obrigatório, país, limites de usuários e conexões. Todas as queries filtram por clientId.', keywords: ['cliente', 'tenant', 'organizacao', 'multi'] },
      { title: 'Perfis de acesso', content: 'Perfis agrupam funcionalidades. Padrões: Administrador (tudo), DBA (tudo exceto admin), Operador (view + execute), Viewer (somente leitura). Crie perfis customizados selecionando funcionalidades por módulo.', keywords: ['perfil', 'permissao', 'acesso', 'funcionalidade'] },
      { title: 'Funcionalidades', content: '35 funcionalidades em 14 módulos. São auto-registradas pelo sistema no boot. Não podem ser criadas/editadas manualmente. A tela Funcionalidades é somente leitura com descrição de cada uma.', keywords: ['funcionalidade', 'feature', 'modulo', 'permissao'] },
      { title: 'Soft delete e auditoria', content: 'NADA é deletado permanentemente. Toda operação (criar, alterar, excluir) grava: quem fez, quando, e o diff (valor antigo → novo). Acesse em Auditoria.', keywords: ['soft', 'delete', 'auditoria', 'log', 'historico', 'quem'] },
    ]
  },
  {
    id: 'notifications', title: 'Notificações', icon: Bell, category: 'Configuração',
    articles: [
      { title: 'Telegram', content: 'Crie um bot via @BotFather, copie o token. Obtenha o chat_id do grupo/canal. Configure em Notificações → Novo → Telegram. Teste com o botão "Testar".', keywords: ['telegram', 'bot', 'token', 'chatid'] },
      { title: 'Webhook', content: 'Informe a URL que receberá o POST com o payload JSON: { title, message, severity, alertId, databases, timestamp }.', keywords: ['webhook', 'url', 'post', 'json'] },
      { title: 'Email (SMTP)', content: 'Configure: host SMTP, porta, usuário, senha, destinatários. Suporta TLS. Ex: smtp.gmail.com:587.', keywords: ['email', 'smtp', 'gmail'] },
      { title: 'Slack', content: 'Crie um Incoming Webhook no Slack (Apps → Incoming Webhooks). Cole a URL webhook.', keywords: ['slack', 'webhook', 'canal'] },
    ]
  },
  {
    id: 'api', title: 'API (Swagger)', icon: FileText, category: 'Desenvolvimento',
    articles: [
      { title: 'Documentação da API', content: 'Acesse /api/docs para a documentação interativa Swagger UI. Todas as rotas estão documentadas com parâmetros, exemplos e respostas. Use o botão "Authorize" para testar com seu token JWT.', keywords: ['api', 'swagger', 'documentacao', 'rest', 'endpoint'] },
      { title: 'Autenticação', content: 'POST /api/auth/login retorna um token JWT. Inclua em todas as requisições: Authorization: Bearer <token>. Token expira em 24h.', keywords: ['jwt', 'token', 'autenticacao', 'bearer'] },
    ]
  },
  {
    id: 'growth', title: 'Crescimento', icon: TrendingUp, category: 'Análise',
    articles: [
      { title: 'Monitorar crescimento', content: 'O sistema coleta snapshots diários do tamanho de cada tabela. Visualize tendências, configure regras para alertar quando crescer X% em Y dias.', keywords: ['crescimento', 'tamanho', 'snapshot', 'tendencia'] },
    ]
  },
  {
    id: 'vpn', title: 'VPN', icon: Wifi, category: 'Infraestrutura',
    articles: [
      { title: 'Configurar VPN', content: 'Faça upload do arquivo .ovpn (OpenVPN) em VPN → Upload. Clique Conectar. O status aparece na toolbar. Conexões roteadas pela VPN acessam servidores internos.', keywords: ['vpn', 'openvpn', 'ovpn', 'conectar'] },
    ]
  },
];

export default function HelpCenterPage() {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string[]>(['getting-started']);

  const filtered = useMemo(() => {
    if (!search) return HELP_DATA;
    const q = search.toLowerCase();
    return HELP_DATA.map(section => ({
      ...section,
      articles: section.articles.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.content.toLowerCase().includes(q) ||
        a.keywords.some(k => k.includes(q))
      ),
    })).filter(s => s.articles.length > 0);
  }, [search]);

  function toggleSection(id: string) {
    setExpanded(e => e.includes(id) ? e.filter(x => x !== id) : [...e, id]);
  }

  const categories = [...new Set(HELP_DATA.map(s => s.category))];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><HelpCircle className="w-6 h-6" /> Central de Ajuda</h1>
        <a href="/api/docs" target="_blank" className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
          <ExternalLink className="w-3.5 h-3.5" /> API Docs (Swagger)
        </a>
      </div>

      {/* Search */}
      <div className="relative mb-8">
        <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          className="w-full pl-12 pr-4 py-3 border border-border rounded-xl bg-background text-base shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Buscar por tela, funcionalidade ou assunto..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
      </div>

      {/* Results */}
      {search && filtered.length === 0 && (
        <p className="text-center text-muted-foreground py-12">Nenhum resultado para "{search}"</p>
      )}

      <div className="space-y-3">
        {filtered.map(section => (
          <div key={section.id} className="border border-border rounded-lg overflow-hidden">
            <button onClick={() => toggleSection(section.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition text-left">
              {expanded.includes(section.id) ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              <section.icon className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-sm flex-1">{section.title}</span>
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">{section.category}</span>
              <span className="text-xs text-muted-foreground">{section.articles.length} artigos</span>
            </button>
            {expanded.includes(section.id) && (
              <div className="border-t border-border divide-y divide-border">
                {section.articles.map((article, i) => (
                  <div key={i} className="px-6 py-3">
                    <h4 className="font-medium text-sm mb-1">{article.title}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{article.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
