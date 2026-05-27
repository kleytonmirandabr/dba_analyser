import { AppDataSource } from '../config/database';
import { Client } from '../entities/client.entity';
import { Profile } from '../entities/profile.entity';
import { ProfileFeature } from '../entities/profile-feature.entity';
import { User } from '../entities/user.entity';
import { FEATURES } from './feature-registry';

const ALL_FEATURES = FEATURES.map(f => f.code);
const VIEW_FEATURES = FEATURES.filter(f => f.code.endsWith('.view')).map(f => f.code);
const DBA_FEATURES = FEATURES.filter(f => !f.code.startsWith('admin.')).map(f => f.code);
const OPERATOR_FEATURES = [...VIEW_FEATURES, 'query.execute', 'query.export', 'query.history', 'alerts.test', 'monitor.view'];

export async function seedPermissions() {
  const clientRepo = AppDataSource.getRepository(Client);
  const profileRepo = AppDataSource.getRepository(Profile);
  const pfRepo = AppDataSource.getRepository(ProfileFeature);
  const userRepo = AppDataSource.getRepository(User);

  // 1. Default client
  let defaultClient = await clientRepo.findOne({ where: { code: 'sistema' } });
  if (!defaultClient) {
    defaultClient = await clientRepo.save(clientRepo.create({
      name: 'Sistema',
      code: 'sistema',
      timezone: 'America/Sao_Paulo',
      language: 'pt-BR',
      country: 'BR',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '24h',
      maxUsers: 999,
      maxConnections: 999,
      isActive: true,
    }));
    console.log('[Seed] Default client "Sistema" created');
  }

  // 2. Default profiles
  const profiles = [
    { name: 'Administrador', description: 'Acesso completo a todas as funcionalidades', features: ALL_FEATURES, isDefault: false },
    { name: 'DBA', description: 'Acesso completo exceto administração de sistema', features: DBA_FEATURES, isDefault: false },
    { name: 'Operador', description: 'Visualização + execução de queries e testes', features: OPERATOR_FEATURES, isDefault: false },
    { name: 'Viewer', description: 'Somente visualização', features: VIEW_FEATURES, isDefault: true },
  ];

  for (const p of profiles) {
    let profile = await profileRepo.findOne({ where: { name: p.name, clientId: undefined as any } });
    if (!profile) {
      profile = await profileRepo.save(profileRepo.create({
        name: p.name,
        description: p.description,
        clientId: null, // Global profile
        isDefault: p.isDefault,
      }));
      console.log(`[Seed] Profile "${p.name}" created`);
    }

    // Sync features
    const existing = await pfRepo.find({ where: { profileId: profile.id } });
    const existingCodes = existing.map(e => e.featureCode);
    const toAdd = p.features.filter(f => !existingCodes.includes(f));
    if (toAdd.length > 0) {
      await pfRepo.save(toAdd.map(code => pfRepo.create({ profileId: profile!.id, featureCode: code })));
    }
  }

  // 3. Assign admin user to Administrador profile + default client
  const adminProfile = await profileRepo.findOne({ where: { name: 'Administrador' } });
  if (adminProfile && defaultClient) {
    const adminUsers = await userRepo.find({ where: { role: 'admin' } });
    for (const user of adminUsers) {
      if (!user.profileId || !user.clientId) {
        user.profileId = adminProfile.id;
        user.clientId = defaultClient.id;
        await userRepo.save(user);
        console.log(`[Seed] User "${user.username}" assigned to Administrador profile`);
      }
    }
  }

  console.log('[Seed] Permissions seeded successfully');
}
