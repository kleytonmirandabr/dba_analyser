# DBA Analyser 🔍

**Ferramenta de análise de Banco de Dados e controle de versão**

Uma plataforma web para DBAs que centraliza a gestão, comparação e monitoramento de múltiplos bancos de dados.

## 🎯 Problemas que Resolve

| Dor | Solução |
|-----|---------|
| Não sei o que tem em cada banco | **Explorer** — catálogo visual de todos os objetos |
| Deploy quebra por diferenças entre ambientes | **Comparador** — diff de schema + script de migração |
| Só descubro problemas quando usuário liga | **Monitor** — alertas em tempo real de locks/queries |
| Atualizar N bancos manualmente é arriscado | **Deploy Manager** — execução controlada multi-banco |

## 🛠️ Stack

- **Frontend:** React + TypeScript + Tailwind + shadcn/ui
- **Backend:** Node.js + Express + TypeScript
- **Conectores:** PostgreSQL, SQL Server, MySQL
- **Real-time:** WebSocket (socket.io)
- **Deploy:** Docker Compose

## 📋 Sprint

Veja [SPRINT.md](./SPRINT.md) para o planejamento completo.

## 🚀 Quick Start

```bash
git clone git@github.com:kleytonmirandabr/dba_analyser.git
cd dba_analyser
docker compose up
```

## 📄 Licença

MIT
