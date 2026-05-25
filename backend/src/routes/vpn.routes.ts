import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { vpnService } from '../services/vpn.service';

const router = Router();

// GET /api/vpn/status
router.get('/status', authMiddleware, async (_req: Request, res: Response) => {
  const status = await vpnService.getStatus();
  return res.json({ data: status });
});

// POST /api/vpn/upload
router.post('/upload', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { ovpnContent, username, password } = req.body;
    if (!ovpnContent) return res.status(400).json({ error: 'Conteúdo do arquivo .ovpn é obrigatório' });

    const credentials = username && password ? { user: username, pass: password } : undefined;
    await vpnService.uploadConfig(ovpnContent, credentials);

    return res.json({ data: { message: 'Configuração VPN salva. Reinicie o container VPN para conectar.' } });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/vpn/config
router.delete('/config', authMiddleware, requireRole('admin'), async (_req: Request, res: Response) => {
  await vpnService.removeConfig();
  return res.json({ data: { message: 'Configuração VPN removida' } });
});


// POST /api/vpn/connect - restart VPN container to apply config
router.post('/connect', authMiddleware, requireRole('admin'), async (_req: Request, res: Response) => {
  try {
    const { execSync } = require('child_process');
    // Try to restart VPN container
    try {
      execSync('docker restart dba_analyser-vpn-1', { encoding: 'utf8', timeout: 10000 });
      return res.json({ data: { message: 'Container VPN reiniciado. Aguarde conexão...' } });
    } catch (cmdErr: any) {
      // Docker socket not accessible from inside container
      return res.status(400).json({ 
        error: 'Não foi possível reiniciar o container VPN automaticamente. Execute: docker compose restart vpn',
        code: 'DOCKER_NOT_ACCESSIBLE',
        hint: 'Para controle automático, monte o Docker socket: -v /var/run/docker.sock:/var/run/docker.sock'
      });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/vpn/disconnect - stop VPN container
router.post('/disconnect', authMiddleware, requireRole('admin'), async (_req: Request, res: Response) => {
  try {
    const { exec } = require('child_process');
    await new Promise<void>((resolve, reject) => {
      exec('docker stop dba_analyser-vpn-1 2>/dev/null || echo "no vpn container"', (err: any, stdout: string) => {
        if (err && !stdout.includes('no vpn')) reject(err);
        else resolve();
      });
    });
    return res.json({ data: { message: 'VPN desconectada' } });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/vpn/logs - get VPN container logs
router.get('/logs', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { execSync } = require('child_process');
    const lines = parseInt(req.query.lines as string) || 50;
    const containerName = execSync('docker ps --format "{{.Names}}" 2>/dev/null | grep vpn || echo ""', { encoding: 'utf8' }).trim();
    if (!containerName) {
      return res.json({ data: { logs: ['Container VPN não encontrado'] } });
    }
    const logs = execSync(`docker logs --tail ${lines} ${containerName} 2>&1`, { encoding: 'utf8' });
    return res.json({ data: { logs: logs.split('\n').filter(Boolean) } });
  } catch (err: any) {
    return res.json({ data: { logs: ['Erro ao obter logs: ' + err.message] } });
  }
});

export default router;
