import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireFeature } from '../middleware/feature.middleware';
import { k8sService, ValidationException } from '../services/k8s.service';

const router = Router();

// ═══════════════════════════════════════════════
// RATE LIMITING — per-IP for sensitive endpoints
// ═══════════════════════════════════════════════

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_SENSITIVE = 10; // 10 requests per minute for credential endpoints
const RATE_LIMIT_MAX_READ = 60; // 60 requests per minute for read endpoints

function rateLimit(max: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip}:${req.path}:${max}`;
    const now = Date.now();
    const entry = rateLimitMap.get(key);

    if (!entry || entry.resetAt < now) {
      rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
      return next();
    }

    if (entry.count >= max) {
      return res.status(429).json({
        error: 'Rate limit excedido. Tente novamente em 1 minuto.',
        retryAfter: Math.ceil((entry.resetAt - now) / 1000)
      });
    }

    entry.count++;
    return next();
  };
}

// Clean rate limit map every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap) {
    if (val.resetAt < now) rateLimitMap.delete(key);
  }
}, 300000);

// ═══════════════════════════════════════════════
// AUDIT LOGGING
// ═══════════════════════════════════════════════

function auditLog(action: string, userId: string, details: Record<string, any>) {
  console.log(`[K8S-AUDIT] ${new Date().toISOString()} | ${action} | user=${userId} | ${JSON.stringify(details)}`);
}

// ═══════════════════════════════════════════════
// ROUTES — Read operations (rate limit: 60/min)
// ═══════════════════════════════════════════════

// GET /api/k8s/clusters
router.get('/clusters', authMiddleware, rateLimit(RATE_LIMIT_MAX_READ), async (req: Request, res: Response) => {
  try {
    const clusters = await k8sService.listClusters();
    return res.json({ data: clusters });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/k8s/overview/:clusterId
router.get('/overview/:clusterId', authMiddleware, rateLimit(RATE_LIMIT_MAX_READ), async (req: Request, res: Response) => {
  try {
    const overview = await k8sService.getOverview(req.params.clusterId);
    return res.json({ data: overview });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/k8s/deployments/:clusterId
router.get('/deployments/:clusterId', authMiddleware, rateLimit(RATE_LIMIT_MAX_READ), async (req: Request, res: Response) => {
  try {
    const ns = req.query.namespace as string | undefined;
    const deployments = await k8sService.getDeployments(req.params.clusterId, ns);
    return res.json({ data: deployments });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/k8s/pods/:clusterId
router.get('/pods/:clusterId', authMiddleware, rateLimit(RATE_LIMIT_MAX_READ), async (req: Request, res: Response) => {
  try {
    const ns = req.query.namespace as string | undefined;
    const pods = await k8sService.getPods(req.params.clusterId, ns);
    return res.json({ data: pods });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/k8s/nodes/:clusterId
router.get('/nodes/:clusterId', authMiddleware, rateLimit(RATE_LIMIT_MAX_READ), async (req: Request, res: Response) => {
  try {
    const nodes = await k8sService.getNodes(req.params.clusterId);
    return res.json({ data: nodes });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/k8s/services/:clusterId
router.get('/services/:clusterId', authMiddleware, rateLimit(RATE_LIMIT_MAX_READ), async (req: Request, res: Response) => {
  try {
    const ns = req.query.namespace as string | undefined;
    const services = await k8sService.getServices(req.params.clusterId, ns);
    return res.json({ data: services });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/k8s/ingress/:clusterId
router.get('/ingress/:clusterId', authMiddleware, rateLimit(RATE_LIMIT_MAX_READ), async (req: Request, res: Response) => {
  try {
    const ns = req.query.namespace as string | undefined;
    const ingress = await k8sService.getIngress(req.params.clusterId, ns);
    return res.json({ data: ingress });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════
// ROUTES — Sensitive operations (rate limit: 10/min + audit + RBAC)
// ═══════════════════════════════════════════════

// POST /api/k8s/clusters — Create cluster (SENSITIVE: handles credentials)
router.post('/clusters', authMiddleware, requireFeature('k8s.manage'), rateLimit(RATE_LIMIT_MAX_SENSITIVE), async (req: Request, res: Response) => {
  const userId = (req as any).user?.username || 'unknown';
  try {
    const result = await k8sService.addCluster(req.body, userId);
    auditLog('CREATE_CLUSTER', userId, { clusterId: result.id, name: result.name, authMethod: req.body.authMethod });
    return res.json({ data: result });
  } catch (err: any) {
    if (err instanceof ValidationException) {
      auditLog('CREATE_CLUSTER_FAILED', userId, { errors: err.errors });
      return res.status(422).json({ error: 'Validação falhou', details: err.errors });
    }
    auditLog('CREATE_CLUSTER_ERROR', userId, { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/k8s/clusters/:id — Update cluster
router.put('/clusters/:id', authMiddleware, requireFeature('k8s.manage'), rateLimit(RATE_LIMIT_MAX_SENSITIVE), async (req: Request, res: Response) => {
  const userId = (req as any).user?.username || 'unknown';
  try {
    await k8sService.updateCluster(req.params.id, req.body, userId);
    auditLog('UPDATE_CLUSTER', userId, { clusterId: req.params.id, fields: Object.keys(req.body) });
    return res.json({ data: { message: 'Cluster atualizado' } });
  } catch (err: any) {
    auditLog('UPDATE_CLUSTER_ERROR', userId, { clusterId: req.params.id, error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/k8s/clusters/:id — Delete cluster
router.delete('/clusters/:id', authMiddleware, requireFeature('k8s.manage'), rateLimit(RATE_LIMIT_MAX_SENSITIVE), async (req: Request, res: Response) => {
  const userId = (req as any).user?.username || 'unknown';
  try {
    await k8sService.deleteCluster(req.params.id);
    auditLog('DELETE_CLUSTER', userId, { clusterId: req.params.id });
    return res.json({ data: { message: 'Cluster removido — dados criptografados destruídos' } });
  } catch (err: any) {
    auditLog('DELETE_CLUSTER_ERROR', userId, { clusterId: req.params.id, error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/k8s/clusters/:id/test — Test connection (decrypts credentials)
router.post('/clusters/:id/test', authMiddleware, rateLimit(RATE_LIMIT_MAX_SENSITIVE), async (req: Request, res: Response) => {
  const userId = (req as any).user?.username || 'unknown';
  try {
    auditLog('TEST_CONNECTION', userId, { clusterId: req.params.id });
    const result = await k8sService.testConnection(req.params.id);
    return res.json({ data: result });
  } catch (err: any) {
    return res.json({ data: { ok: false, error: err.message } });
  }
});

// GET /api/k8s/clusters/:id/namespaces
router.get('/clusters/:id/namespaces', authMiddleware, rateLimit(RATE_LIMIT_MAX_READ), async (req: Request, res: Response) => {
  try {
    const namespaces = await k8sService.getNamespaces(req.params.id);
    return res.json({ data: namespaces });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/k8s/clusters/:id/namespaces
router.put('/clusters/:id/namespaces', authMiddleware, requireFeature('k8s.manage'), rateLimit(RATE_LIMIT_MAX_SENSITIVE), async (req: Request, res: Response) => {
  const userId = (req as any).user?.username || 'unknown';
  try {
    const result = await k8sService.updateNamespaces(req.params.id, req.body.namespaces);
    auditLog('UPDATE_NAMESPACES', userId, { clusterId: req.params.id, namespaces: req.body.namespaces });
    return res.json({ data: result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
