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
    // Check if VPN container exists
    try {
      const result = execSync('docker ps -a --format "{{.Names}}" 2>/dev/null | grep vpn || echo ""', { encoding: 'utf8' }).trim();
      if (!result) {
        return res.status(400).json({ 
          error: 'Container VPN não encontrado. Este ambiente está rodando sem VPN (docker-compose.dev.yml). Para usar VPN, rode com: docker compose up --build (compose principal com sidecar OpenVPN).',
          code: 'NO_VPN_CONTAINER'
        });
      }
      execSync(`docker restart ${result}`, { encoding: 'utf8' });
      return res.json({ data: { message: 'Container VPN reiniciado. Aguarde conexão...' } });
    } catch (cmdErr: any) {
      // Docker not accessible from inside container — expected in most setups
      return res.status(400).json({ 
        error: 'Não foi possível controlar o container VPN a partir do backend. Para conectar, execute manualmente: docker compose restart vpn',
        code: 'DOCKER_NOT_ACCESSIBLE'
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

export default router;
