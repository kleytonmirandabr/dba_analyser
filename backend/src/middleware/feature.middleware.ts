import { Request, Response, NextFunction } from 'express';

/**
 * Middleware that checks if the authenticated user has a specific feature permission.
 * Features are loaded into the JWT token from the user's profile.
 * 
 * Usage: requireFeature('alerts.manage')
 */
export function requireFeature(...features: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    // Admin role bypasses feature check (backwards compat during migration)
    if ((req.user as any).role === 'admin') {
      return next();
    }

    const userFeatures: string[] = (req.user as any).features || [];

    const hasPermission = features.some(f => userFeatures.includes(f));
    if (!hasPermission) {
      return res.status(403).json({ 
        error: 'Sem permissão para esta ação',
        required: features,
      });
    }

    next();
  };
}
