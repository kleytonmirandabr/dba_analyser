import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireFeature } from '../middleware/feature.middleware';
import { k8sService } from '../services/k8s.service';

const router = Router();

// GET /api/k8s/clusters
router.get('/clusters', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const clusters = await k8sService.listClusters();
    return res.json({ data: clusters });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/k8s/clusters
router.post('/clusters', authMiddleware, requireFeature('k8s.manage'), async (req: Request, res: Response) => {
  try {
    const cluster = await k8sService.addCluster(req.body);
    return res.json({ data: { id: cluster.id, name: cluster.name, message: 'Cluster adicionado com sucesso' } });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/k8s/clusters/:id
router.put('/clusters/:id', authMiddleware, requireFeature('k8s.manage'), async (req: Request, res: Response) => {
  try {
    await k8sService.updateCluster(req.params.id, req.body);
    return res.json({ data: { message: 'Cluster atualizado' } });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/k8s/clusters/:id
router.delete('/clusters/:id', authMiddleware, requireFeature('k8s.manage'), async (req: Request, res: Response) => {
  try {
    await k8sService.deleteCluster(req.params.id);
    return res.json({ data: { message: 'Cluster removido' } });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/k8s/clusters/:id/test
router.post('/clusters/:id/test', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await k8sService.testConnection(req.params.id);
    return res.json({ data: result });
  } catch (err: any) {
    return res.json({ data: { ok: false, error: err.message } });
  }
});

// GET /api/k8s/clusters/:id/namespaces
router.get('/clusters/:id/namespaces', authMiddleware, async (req: Request, res: Response) => {
  try {
    const namespaces = await k8sService.getNamespaces(req.params.id);
    return res.json({ data: namespaces });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/k8s/clusters/:id/namespaces
router.put('/clusters/:id/namespaces', authMiddleware, requireFeature('k8s.manage'), async (req: Request, res: Response) => {
  try {
    const result = await k8sService.updateNamespaces(req.params.id, req.body.namespaces);
    return res.json({ data: result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/k8s/overview/:clusterId
router.get('/overview/:clusterId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const overview = await k8sService.getOverview(req.params.clusterId);
    return res.json({ data: overview });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/k8s/deployments/:clusterId
router.get('/deployments/:clusterId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const ns = req.query.namespace as string | undefined;
    const deployments = await k8sService.getDeployments(req.params.clusterId, ns);
    return res.json({ data: deployments });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/k8s/pods/:clusterId
router.get('/pods/:clusterId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const ns = req.query.namespace as string | undefined;
    const pods = await k8sService.getPods(req.params.clusterId, ns);
    return res.json({ data: pods });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/k8s/nodes/:clusterId
router.get('/nodes/:clusterId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const nodes = await k8sService.getNodes(req.params.clusterId);
    return res.json({ data: nodes });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/k8s/services/:clusterId
router.get('/services/:clusterId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const ns = req.query.namespace as string | undefined;
    const services = await k8sService.getServices(req.params.clusterId, ns);
    return res.json({ data: services });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/k8s/ingress/:clusterId
router.get('/ingress/:clusterId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const ns = req.query.namespace as string | undefined;
    const ingress = await k8sService.getIngress(req.params.clusterId, ns);
    return res.json({ data: ingress });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
