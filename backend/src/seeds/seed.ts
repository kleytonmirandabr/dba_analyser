import * as bcrypt from 'bcryptjs';
import { AppDataSource } from '../config/database';
import { User } from '../entities/user.entity';

export async function seedDefaultAdmin() {
  const userRepo = AppDataSource.getRepository(User);
  const existing = await userRepo.findOne({ where: { username: 'admin' } });
  
  if (!existing) {
    const hash = await bcrypt.hash('Dba@2025!Secure', 12);
    await userRepo.save({
      name: 'Administrador',
      username: 'admin',
      email: null,
      passwordHash: hash,
      role: 'admin',
      isActive: true,
    });
    console.log('[Seed] Admin padrão criado: admin / Dba@2025!Secure');
  }
}
