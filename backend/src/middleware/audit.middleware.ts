import { Request, Response, NextFunction } from 'express';
import { AppDataSource } from '../config/database';
import { AuditLog } from '../entities/audit-log.entity';

export function auditMiddleware(action: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    
    // Capture response
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      const duration = Date.now() - start;
      
      // Log asynchronously (don't block response)
      if (req.user) {
        AppDataSource.getRepository(AuditLog).save({
          userId: req.user.userId,
          action,
          connectionId: req.params.connectionId || null,
          targetObject: req.path,
          result: res.statusCode < 400 ? 'SUCCESS' : 'ERROR',
          durationMs: duration,
          ipAddress: req.ip || req.socket.remoteAddress || null,
          metadata: { method: req.method, statusCode: res.statusCode },
        }).catch(() => {}); // Never fail on audit
      }
      
      return originalJson(body);
    };
    
    next();
  };
}
