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

export default router;
