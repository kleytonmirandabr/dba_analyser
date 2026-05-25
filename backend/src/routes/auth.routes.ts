import { Router, Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { z } from 'zod';
import { AppDataSource } from '../config/database';
import { User } from '../entities/user.entity';

const router = Router();
const userRepo = () => AppDataSource.getRepository(User);

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRES = '24h';

// POST /api/auth/login
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(6) });

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await userRepo().findOne({ where: { email, isActive: true } });
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Credenciais inválidas' });

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    return res.json({ data: { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } } });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Dados inválidos', details: err.errors });
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
    return res.json({ data: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
});

export default router;
