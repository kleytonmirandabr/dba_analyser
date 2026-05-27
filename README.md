# DBA Analyser 🔍

**Plataforma completa de administração, monitoramento e DevOps para bancos de dados**

Uma aplicação web profissional que centraliza a gestão de múltiplos bancos de dados (SQL Server, PostgreSQL, MySQL) com módulo Kubernetes integrado, comparação inteligente de schemas, e VPN remota.

![Version](https://img.shields.io/badge/version-2.6.0-purple)
![Docker](https://img.shields.io/badge/docker-compose-blue)
![TypeScript](https://img.shields.io/badge/typescript-5.x-blue)
![React](https://img.shields.io/badge/react-18-61dafb)
![Node](https://img.shields.io/badge/node-22-green)

## 🎯 Problemas que Resolve

| Dor | Solução |
|-----|---------|
| Não sei o que tem em cada banco | **Explorer** — catálogo visual de todos os objetos |
| Deploy quebra por diferenças entre ambientes | **Comparador** — diff inteligente com highlighting word-level |
| Só descubro problemas quando usuário liga | **Monitor** — alertas em tempo real de locks/queries |
| Preciso comparar schemas de 600+ linhas | **Smart Diff** — navegação, filtro, fullscreen |
| Preciso monitorar clusters K8s | **Módulo DevOps** — pods, nodes, deployments, services |
| Não tenho VPN pra acessar o banco | **VPN Integrada** — upload .ovpn e restart pela UI |

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────┐
│                   Docker Compose                     │
│                                                     │
│  ┌──────────┐   ┌───────────────────────────────┐  │
│  │ postgres │   │      vpn (OpenVPN Client)      │  │
│  │  :5432   │   │  ┌─────────────────────────┐   │  │
│  │          │◄──┤  │  backend (Node.js 22)   │   │  │
│  └──────────┘   │  │  network_mode: vpn      │   │  │
│                 │  └─────────────────────────┘   │  │
│                 │       tun0 → 10.0.0.18         │  │
│                 │       :3030 exposed            │  │
│                 └───────────────────────────────┘  │
│                                                     │
│  ┌──────────────────┐                              │
│  │  frontend (Vite) │                              │
│  │  React + TS      │                              │
│  │  :5173           │                              │
│  └──────────────────┘                              │
└─────────────────────────────────────────────────────┘
```

## 🛠️ Stack

### Frontend
- **React 18** + TypeScript + Vite 5.4
- **Tailwind CSS** (CSS Variables + dark/light mode)
- **Zustand** (state management)
- **Lucide React** (ícones)
- **i18next** (PT/EN/ES)
- **Socket.IO Client** (real-time)

### Backend
- **Node.js 22** + Express + TypeScript
- **TypeORM** (PostgreSQL interno)
- **@kubernetes/client-node** (AKS monitoring)
- **Socket.IO** (WebSocket)
- Adapters: **MSSQL**, **PostgreSQL**, **MySQL**, **Kubernetes**

### Infraestrutura
- **Docker Compose** (4 containers)
- **OpenVPN Client** (sidecar container)
- **PostgreSQL 16** (banco interno)

## 📋 Módulos

### 🗄️ DBA Module
- Dashboard com widgets de saúde
- Gerenciamento de conexões (multi-banco)
- Explorer de objetos (tabelas, views, procedures, triggers)
- IDE SQL com autocomplete
- **Schema Comparator** — diff com LCS, word-level highlight, navegação ↑↓, filtro, fullscreen
- Monitor de sessões e locks
- Health collectors + indicadores
- Alertas configuráveis
- Crescimento de tabelas + projeções
- ER Diagram
- Deploy controlado multi-banco
- Backup monitoring
- Relatórios PDF
- AI Query Advisor

### ☸️ Kubernetes Module (DevOps)
- Dashboard de clusters
- Gerenciamento de credenciais (**AES-256-GCM**, per-field salt)
- Deployments, Pods, Nodes, Services, Ingress
- **READ-ONLY** — zero write access ao cluster
- Rate limiting + audit logging

### 🔐 Administração
- Usuários + Perfis (RBAC)
- 35+ feature flags
- Auditoria completa
- Multi-tenancy (Clients)
- 2FA (TOTP)
- VPN remote management

## 🚀 Quick Start

### Pré-requisitos
- Docker 24+ com Compose v2
- Git

### Instalação
```bash
# Clone
git clone git@github.com:kleytonmirandabr/dba_analyser.git
cd dba_analyser

# Configurar ambiente
cp .env.example .env
# Editar .env com suas chaves (openssl rand -hex 32)

# Subir containers
sudo docker compose up -d

# Acessar
open http://localhost:5173
```

### Credenciais padrão
| Recurso | Usuário | Senha |
|---------|---------|-------|
| App | admin | Dba@2025!Secure |
| PostgreSQL | dba_app | dba_secret |

## 📁 Estrutura do Projeto

```
dba_analyser/
├── frontend/          # React SPA (37 páginas)
│   ├── src/pages/     # Todas as páginas
│   ├── src/components/# Componentes reutilizáveis
│   ├── src/i18n/      # Internacionalização
│   └── src/lib/       # API client, utils
├── backend/           # API REST (27 rotas)
│   ├── src/routes/    # Endpoints
│   ├── src/adapters/  # DB connectors + K8s
│   ├── src/services/  # Business logic
│   ├── src/entities/  # TypeORM (22 entities)
│   └── src/middleware/ # Auth, RBAC
├── docker-compose.yml # Dev environment
├── demandas/          # Feature specs
└── CLAUDE.md          # Documentação técnica completa
```

## 🔒 Segurança

- **JWT** + refresh tokens + 2FA
- **RBAC** feature-based (35 features, 4 perfis)
- **AES-256-GCM** para credenciais K8s (PBKDF2 100k iterations, per-field salt)
- **Rate limiting** em endpoints sensíveis
- **Audit logging** em todas operações críticas
- **Kubernetes READ-ONLY** enforced no adapter

## 🌐 Internacionalização

Suporte completo a 3 idiomas:
- 🇧🇷 Português (BR)
- 🇺🇸 English
- 🇪🇸 Español

## 📄 Licença

MIT

---

*Desenvolvido por [Kleyton Miranda](https://github.com/kleytonmirandabr)*
