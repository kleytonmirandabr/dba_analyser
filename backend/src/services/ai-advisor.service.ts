import { ExplainNode, ExplainResult, SlowQuery } from '../adapters/base.adapter';

export interface QueryAdviceResult {
  originalQuery: string;
  explainPlan: ExplainResult;
  suggestions: AiSuggestion[];
  optimizedQuery?: string;
  summary: string;
  severity: 'critical' | 'warning' | 'info' | 'ok';
}

export interface AiSuggestion {
  type: 'index' | 'rewrite' | 'config' | 'schema' | 'general';
  title: string;
  description: string;
  sql?: string; // suggested CREATE INDEX or rewritten query
  impact: 'high' | 'medium' | 'low';
}

// Heuristic-based analysis (works without AI)
export function analyzeExplainHeuristic(explain: ExplainResult, query: string, dbType: string): QueryAdviceResult {
  const suggestions: AiSuggestion[] = [];
  let severity: QueryAdviceResult['severity'] = 'ok';

  // Walk the tree and find issues
  walkPlan(explain.plan, (node) => {
    // Sequential/Table scans on large tables
    if ((node.nodeType === 'Seq Scan' || node.nodeType === 'Table Scan' || node.nodeType === 'Clustered Index Scan') && node.planRows > 10000) {
      severity = node.planRows > 100000 ? 'critical' : 'warning';
      const cols = extractFilterColumns(node.filter || node.indexCond || '');
      suggestions.push({
        type: 'index',
        title: `Scan completo em ${node.relation || 'tabela'} (~${node.planRows.toLocaleString()} rows)`,
        description: `O banco está lendo todas as linhas da tabela. Um índice nos campos do WHERE pode eliminar este scan.`,
        sql: cols.length > 0 ? `CREATE INDEX idx_${(node.relation || 'table').toLowerCase()}_${cols.join('_')} ON ${node.relation}(${cols.join(', ')});` : undefined,
        impact: node.planRows > 100000 ? 'high' : 'medium',
      });
    }

    // Sort in disk
    if (node.nodeType === 'Sort' && node.extra?.sortMethod?.includes('external')) {
      severity = severity === 'ok' ? 'warning' : severity;
      suggestions.push({
        type: 'config',
        title: 'Sort em disco (spill)',
        description: 'A ordenação não coube em memória. Aumente work_mem para esta sessão ou crie índice na ordem do ORDER BY.',
        sql: `SET work_mem = '256MB'; -- para a sessão atual`,
        impact: 'medium',
      });
    }

    // Nested Loop com alta cardinalidade
    if (node.nodeType === 'Nested Loop' && node.planRows > 50000) {
      suggestions.push({
        type: 'rewrite',
        title: 'Nested Loop com alta cardinalidade',
        description: 'O plano usa Nested Loop com muitas iterações. Se possível, reescreva o JOIN ou garanta que a tabela interna tenha índice na coluna de join.',
        impact: 'high',
      });
    }

    // Hash Join com rows removidas por filtro
    if (node.extra?.rowsRemovedByFilter && node.extra.rowsRemovedByFilter > node.planRows * 5) {
      suggestions.push({
        type: 'index',
        title: 'Muitas rows descartadas pelo filtro',
        description: `${node.extra.rowsRemovedByFilter.toLocaleString()} rows lidas mas filtradas. Índice parcial ou composto pode ajudar.`,
        impact: 'medium',
      });
    }
  });

  // Add warnings from explain as suggestions
  for (const w of explain.warnings) {
    if (!suggestions.some(s => s.description.includes(w))) {
      suggestions.push({ type: 'general', title: 'Aviso do plano', description: w, impact: 'low' });
    }
  }

  if (suggestions.length === 0) severity = 'ok';

  const summary = suggestions.length === 0
    ? 'Query com plano de execução adequado. Nenhum problema detectado.'
    : `Encontrados ${suggestions.length} ponto(s) de atenção. ${suggestions.filter(s => s.impact === 'high').length} de alto impacto.`;

  return { originalQuery: query, explainPlan: explain, suggestions, summary, severity };
}

// AI-powered analysis (requires OpenAI key)
export async function analyzeWithAI(
  explain: ExplainResult,
  query: string,
  dbType: string,
  tableContext: string,
  apiKey: string
): Promise<{ optimizedQuery?: string; aiSuggestions: AiSuggestion[]; aiSummary: string }> {
  const prompt = buildPrompt(explain, query, dbType, tableContext);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${err}`);
    }

    const data = await response.json() as any;
    const content = JSON.parse(data.choices[0].message.content);

    return {
      optimizedQuery: content.optimizedQuery || undefined,
      aiSuggestions: (content.suggestions || []).map((s: any) => ({
        type: s.type || 'general',
        title: s.title,
        description: s.description,
        sql: s.sql,
        impact: s.impact || 'medium',
      })),
      aiSummary: content.summary || 'Análise concluída.',
    };
  } catch (err: any) {
    return { aiSuggestions: [], aiSummary: `Erro na análise AI: ${err.message}` };
  }
}

const SYSTEM_PROMPT = `Você é um DBA especialista em otimização de queries SQL.
Analise o plano de execução fornecido e responda em JSON com:
{
  "summary": "resumo em português do problema principal",
  "optimizedQuery": "query reescrita otimizada (ou null se não aplicável)",
  "suggestions": [
    {
      "type": "index|rewrite|config|schema|general",
      "title": "título curto",
      "description": "explicação detalhada em português",
      "sql": "comando SQL sugerido (CREATE INDEX, ALTER, etc)",
      "impact": "high|medium|low"
    }
  ]
}
Seja específico. Use nomes reais de tabelas e colunas do contexto.
Priorize sugestões de alto impacto. Máximo 5 sugestões.`;

function buildPrompt(explain: ExplainResult, query: string, dbType: string, tableContext: string): string {
  return `## Database: ${dbType}

## Query Original:
\`\`\`sql
${query}
\`\`\`

## Plano de Execução (JSON):
\`\`\`json
${JSON.stringify(explain.rawPlan, null, 2).slice(0, 4000)}
\`\`\`

## Warnings detectados:
${explain.warnings.length > 0 ? explain.warnings.join('\n') : 'Nenhum'}

## Contexto de tabelas (colunas, índices existentes):
${tableContext || 'Não disponível'}

## Métricas:
- Tempo de execução: ${explain.executionTimeMs ? explain.executionTimeMs + 'ms' : 'N/A'}
- Tempo de planejamento: ${explain.planningTimeMs ? explain.planningTimeMs + 'ms' : 'N/A'}

Analise e sugira otimizações.`;
}

// Helpers
function walkPlan(node: ExplainNode, fn: (n: ExplainNode) => void) {
  fn(node);
  if (node.children) node.children.forEach(c => walkPlan(c, fn));
}

function extractFilterColumns(filter: string): string[] {
  // Extract column names from filter expressions like "(col = $1)" or "col > 5"
  const matches = filter.match(/\b([a-z_][a-z0-9_]*)\b/gi) || [];
  const reserved = new Set(['AND', 'OR', 'NOT', 'NULL', 'IS', 'IN', 'LIKE', 'BETWEEN', 'TRUE', 'FALSE', 'ANY', 'ALL']);
  return [...new Set(matches.filter(m => !reserved.has(m.toUpperCase()) && !/^\d/.test(m)))].slice(0, 3);
}
