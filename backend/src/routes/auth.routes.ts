import { Router, Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/database';
import { User } from '../entities/user.entity';
import { AuditLog } from '../entities/audit-log.entity';

const router = Router();
const userRepo = () => AppDataSource.getRepository(User);

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'dev-secret') {
  console.error('[SECURITY] JWT_SECRET must be set in production!');
  process.exit(1);
}
const JWT_EXPIRES = '24h';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// In-memory rate limit (per IP)
const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX = 10; // max 10 attempts per minute per IP

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now - record.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
    return false;
  }
  record.count++;
  return record.count > RATE_LIMIT_MAX;
}

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    // Rate limit check
    if (isRateLimited(ip)) {
      return res.status(429).json({ error: 'Muitas tentativas. Aguarde 1 minuto.' });
    }

    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }

    const user = await userRepo().findOne({ where: { username, isActive: true } });
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Account lockout check
    if (user.lockedUntil && new Date() < new Date(user.lockedUntil)) {
      const remainingMin = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000);
      return res.status(423).json({ error: `Conta bloqueada. Tente novamente em ${remainingMin} minuto(s).` });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      // Increment failed attempts
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        user.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60000);
        await userRepo().save(user);
        return res.status(423).json({ error: `Conta bloqueada por ${LOCKOUT_MINUTES} minutos após ${MAX_FAILED_ATTEMPTS} tentativas falhas.` });
      }
      await userRepo().save(user);
      // Audit: login failure
      await AppDataSource.getRepository(AuditLog).save({
        userId: user.id, action: 'LOGIN_FAILED', entity: 'auth',
        details: JSON.stringify({ ip, attempts: user.failedLoginAttempts }),
      });
      const remaining = MAX_FAILED_ATTEMPTS - user.failedLoginAttempts;
      return res.status(401).json({ error: `Credenciais inválidas. ${remaining} tentativa(s) restante(s).` });
    }

    // Reset failed attempts on success
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
      await userRepo().save(user);
    }

    // Load user features from profile
    let features: string[] = [];
    let clientTimezone = 'UTC';
    let clientLanguage = 'pt-BR';
    if (user.profileId) {
      const { ProfileFeature } = await import('../entities/profile-feature.entity');
      const pfs = await AppDataSource.getRepository(ProfileFeature).find({ where: { profileId: user.profileId } });
      features = pfs.map(pf => pf.featureCode);
    }
    if (user.clientId) {
      const { Client } = await import('../entities/client.entity');
      const client = await AppDataSource.getRepository(Client).findOne({ where: { id: user.clientId } });
      if (client) {
        clientTimezone = client.timezone;
        clientLanguage = client.language;
      }
    }

    const token = jwt.sign(
      {
        userId: user.id, username: user.username, role: user.role, name: user.name,
        clientId: user.clientId || null,
        profileId: user.profileId || null,
        features,
        timezone: user.preferredTimezone || clientTimezone,
        language: user.preferredLanguage || clientLanguage,
        iat: Math.floor(Date.now() / 1000),
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    // Audit: login success
    await AppDataSource.getRepository(AuditLog).save({
      userId: user.id, action: 'LOGIN_SUCCESS', entity: 'auth',
      details: JSON.stringify({ ip, username: user.username }),
    });

    return res.json({ data: { token, user: { id: user.id, name: user.name, username: user.username, role: user.role, clientId: user.clientId, profileId: user.profileId, features, timezone: user.preferredTimezone || clientTimezone, language: user.preferredLanguage || clientLanguage } } });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token não fornecido' });

  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as any;
    const user = await userRepo().findOne({ where: { id: payload.userId, isActive: true } });
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });
    return res.json({ data: { id: user.id, name: user.name, username: user.username, role: user.role } });
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token não fornecido' });

  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as any;
    const user = await userRepo().findOne({ where: { id: payload.userId } });
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Campos obrigatórios' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Senha deve ter no mínimo 8 caracteres' });
    if (!/[A-Z]/.test(newPassword)) return res.status(400).json({ error: 'Senha deve conter letra maiúscula' });
    if (!/[0-9]/.test(newPassword)) return res.status(400).json({ error: 'Senha deve conter número' });
    if (!/[^A-Za-z0-9]/.test(newPassword)) return res.status(400).json({ error: 'Senha deve conter caractere especial' });

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Senha atual incorreta' });

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await userRepo().save(user);
    return res.json({ data: { message: 'Senha alterada com sucesso' } });
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
});

// Token blacklist (in-memory, resets on restart - use Redis in production)
const blacklistedTokens = new Set<string>();

export function isTokenBlacklisted(token: string): boolean {
  return blacklistedTokens.has(token);
}

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    blacklistedTokens.add(authHeader.slice(7));
  }
  return res.json({ data: { message: 'Logout realizado' } });
});

// Clean expired tokens every hour
setInterval(() => {
  blacklistedTokens.forEach(token => {
    try { jwt.verify(token, JWT_SECRET); } catch { blacklistedTokens.delete(token); }
  });
}, 3600000);

// PUT /api/auth/me - Update personal preferences
router.put('/me', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token não fornecido' });
  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as any;
    const user = await userRepo().findOne({ where: { id: payload.userId } });
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });
    const { name, email, phone, preferredLanguage, preferredTimezone, avatar } = req.body;
    if (name) user.name = name;
    if (email !== undefined) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (preferredLanguage !== undefined) user.preferredLanguage = preferredLanguage;
    if (preferredTimezone !== undefined) user.preferredTimezone = preferredTimezone;
    if (avatar !== undefined) user.avatar = avatar;
    user.updatedById = user.id;
    await userRepo().save(user);
    return res.json({ data: { id: user.id, name: user.name, email: user.email, phone: user.phone, preferredLanguage: user.preferredLanguage, preferredTimezone: user.preferredTimezone, avatar: user.avatar } });
  } catch { return res.status(401).json({ error: 'Token inválido' }); }
});

export default router;
