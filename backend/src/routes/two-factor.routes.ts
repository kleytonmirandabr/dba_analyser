import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { User } from '../entities/user.entity';
import { authMiddleware } from '../middleware/auth.middleware';
import * as crypto from 'crypto';

const router = Router();
const userRepo = () => AppDataSource.getRepository(User);

// Simple TOTP implementation (no external dependency)
function generateSecret(): string {
  return crypto.randomBytes(20).toString('hex');
}

function generateTOTP(secret: string, time?: number): string {
  const epoch = Math.floor((time || Date.now()) / 30000);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(0, 0);
  buf.writeUInt32BE(epoch, 4);
  const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'hex'));
  hmac.update(buf);
  const hash = hmac.digest();
  const offset = hash[hash.length - 1] & 0xf;
  const code = ((hash[offset] & 0x7f) << 24 | (hash[offset + 1] & 0xff) << 16 | (hash[offset + 2] & 0xff) << 8 | (hash[offset + 3] & 0xff)) % 1000000;
  return code.toString().padStart(6, '0');
}

function verifyTOTP(secret: string, token: string): boolean {
  // Check current and +-1 window
  for (let i = -1; i <= 1; i++) {
    const t = Date.now() + i * 30000;
    if (generateTOTP(secret, t) === token) return true;
  }
  return false;
}

function secretToBase32(hex: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes = Buffer.from(hex, 'hex');
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let result = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    result += alphabet[parseInt(chunk, 2)];
  }
  return result;
}

// POST /api/2fa/setup - Generate secret + QR URL
router.post('/setup', authMiddleware, async (req: Request, res: Response) => {
  const user = await userRepo().findOne({ where: { id: (req.user as any).userId } });
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  if (user.twoFactorEnabled) return res.status(400).json({ error: '2FA já está ativado' });

  const secret = generateSecret();
  user.twoFactorSecret = secret;
  await userRepo().save(user);

  const base32 = secretToBase32(secret);
  const otpauthUrl = `otpauth://totp/DBA%20Analyser:${user.username}?secret=${base32}&issuer=DBA%20Analyser&digits=6&period=30`;

  res.json({ secret: base32, otpauthUrl, message: 'Escaneie o QR code com Google Authenticator ou Authy' });
});

// POST /api/2fa/enable - Verify token and enable
router.post('/enable', authMiddleware, async (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token obrigatório' });

  const user = await userRepo().findOne({ where: { id: (req.user as any).userId } });
  if (!user || !user.twoFactorSecret) return res.status(400).json({ error: 'Primeiro chame /setup' });

  if (!verifyTOTP(user.twoFactorSecret, token)) {
    return res.status(401).json({ error: 'Token inválido. Verifique o código no app.' });
  }

  user.twoFactorEnabled = true;
  await userRepo().save(user);
  res.json({ success: true, message: '2FA ativado com sucesso!' });
});

// POST /api/2fa/disable
router.post('/disable', authMiddleware, async (req: Request, res: Response) => {
  const { token } = req.body;
  const user = await userRepo().findOne({ where: { id: (req.user as any).userId } });
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  if (!user.twoFactorEnabled) return res.status(400).json({ error: '2FA não está ativado' });

  if (!verifyTOTP(user.twoFactorSecret!, token)) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  user.twoFactorEnabled = false;
  user.twoFactorSecret = null;
  await userRepo().save(user);
  res.json({ success: true, message: '2FA desativado' });
});

// POST /api/2fa/verify - Verify during login
router.post('/verify', async (req: Request, res: Response) => {
  const { userId, token } = req.body;
  if (!userId || !token) return res.status(400).json({ error: 'userId e token obrigatórios' });

  const user = await userRepo().findOne({ where: { id: userId } });
  if (!user || !user.twoFactorSecret) return res.status(400).json({ error: 'Usuário sem 2FA' });

  if (!verifyTOTP(user.twoFactorSecret, token)) {
    return res.status(401).json({ error: 'Código inválido' });
  }

  res.json({ verified: true });
});

export default router;
