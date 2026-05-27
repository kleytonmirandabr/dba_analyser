import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireFeature } from '../middleware/feature.middleware';
import { vpnService } from '../services/vpn.service';
import { exec, execSync } from 'child_process';

const router = Router();
const VPN_CONTAINER = 'dba_analyser-vpn-1';

// GET /api/vpn/status
router.get('/status', authMiddleware, async (_req: Request, res: Response) => {
  const status = await vpnService.getStatus();
  return res.json({ data: status });
});

// POST /api/vpn/upload
router.post('/upload', authMiddleware, requireFeature('vpn.manage'), async (req: Request, res: Response) => {
  try {
    const { ovpnContent, username, password } = req.body;
    if (!ovpnContent) return res.status(400).json({ error: 'Conteúdo do arquivo .ovpn é obrigatório' });

    const credentials = username && password ? { user: username, pass: password } : undefined;
    await vpnService.uploadConfig(ovpnContent, credentials);

    return res.json({ data: { message: 'Configuração VPN salva. Clique em Conectar para ativar.' } });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/vpn/config
router.delete('/config', authMiddleware, requireFeature('vpn.manage'), async (_req: Request, res: Response) => {
  await vpnService.removeConfig();
  return res.json({ data: { message: 'Configuração VPN removida' } });
});

// POST /api/vpn/connect - restart VPN container to apply config
router.post('/connect', authMiddleware, requireFeature('vpn.manage'), async (_req: Request, res: Response) => {
  try {
    await dockerExec(`docker restart ${VPN_CONTAINER}`);
    return res.json({ data: { message: 'Container VPN reiniciado com sucesso. Aguarde a conexão...' } });
  } catch (err: any) {
    return res.status(500).json({ 
      error: `Falha ao reiniciar VPN: ${err.message}`,
      code: 'DOCKER_ERROR'
    });
  }
});

// POST /api/vpn/disconnect - stop VPN container
router.post('/disconnect', authMiddleware, requireFeature('vpn.manage'), async (_req: Request, res: Response) => {
  try {
    await dockerExec(`docker stop ${VPN_CONTAINER}`);
    return res.json({ data: { message: 'VPN desconectada' } });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/vpn/restart - explicit restart button
router.post('/restart', authMiddleware, requireFeature('vpn.manage'), async (_req: Request, res: Response) => {
  try {
    // Stop then start to ensure clean restart
    try { execSync(`docker stop ${VPN_CONTAINER}`, { timeout: 10000 }); } catch {}
    await new Promise(r => setTimeout(r, 1000));
    await dockerExec(`docker start ${VPN_CONTAINER}`);
    return res.json({ data: { message: 'Container VPN reiniciado. Aguardando reconexão...' } });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/vpn/logs - get VPN container logs
router.get('/logs', authMiddleware, requireFeature('vpn.manage'), async (req: Request, res: Response) => {
  try {
    const lines = parseInt(req.query.lines as string) || 50;
    const logs = execSync(`docker logs --tail ${lines} ${VPN_CONTAINER} 2>&1`, { encoding: 'utf8', timeout: 5000 });
    return res.json({ data: { logs: logs.split('\n').filter(Boolean) } });
  } catch (err: any) {
    return res.json({ data: { logs: ['Container VPN não encontrado ou erro: ' + err.message] } });
  }
});

function dockerExec(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: 15000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout.trim());
    });
  });
}

export default router;
