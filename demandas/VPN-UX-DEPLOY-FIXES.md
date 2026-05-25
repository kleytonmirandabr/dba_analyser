# Demanda: VPN UX + Deploy Fixes
**Status:** ✅ Completa
**Data:** 2026-05-25

## Escopo
Melhorias de UX na página VPN e correções de deploy (proxy, compose).

## Entregas
- [x] Página VPN dedicada (/vpn) com upload .ovpn + credenciais
- [x] Campo "IP do Servidor VPN" no formulário
- [x] Auto-connect após upload (sem restart manual)
- [x] Indicador de progresso com 4 etapas animadas
- [x] Botões Conectar/Desconectar no status card
- [x] Barra de progresso com pulse animation
- [x] Poll acelerado (3s) durante tentativa de conexão
- [x] docker-compose.dev.yml (funciona sem VPN sidecar)
- [x] Vite proxy config (/api → backend:3030)
- [x] Fix CORS: frontend usa proxy, não precisa de IP fixo

## Commits
| Hash | Mensagem |
|------|----------|
| 2c3e525 | fix: docker-compose.dev.yml sem VPN dependency |
| 49f4a51 | fix: frontend proxy via Vite |
| - | feat: VPN page dedicada |
| - | fix: VPN auto-connect |
| - | feat: VPN progress indicator + campo IP |
