import * as bcrypt from 'bcryptjs';
import { AppDataSource } from '../config/database';
import { User } from '../entities/user.entity';

export async function seedDefaultAdmin() {
  const userRepo = AppDataSource.getRepository(User);
  const existing = await userRepo.findOne({ where: { email: 'admin@dba-analyser.local' } });
  
  if (!existing) {
    const hash = await bcrypt.hash('admin123', 10);
    await userRepo.save({
      name: 'Administrador',
      email: 'admin@dba-analyser.local',
      passwordHash: hash,
      role: 'admin',
      isActive: true,
    });
    console.log('[Seed] Admin padrão criado: admin@dba-analyser.local / admin123');
  }
}
