import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export default function RbacModal({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  const rbacContent = `# 1. Aplicar o RBAC read-only no cluster:
kubectl apply -f k8s-readonly-rbac.yaml

# 2. Gerar token de acesso (válido por 1 ano):
kubectl create token dba-analyser-readonly \\
  -n dba-analyser-monitor \\
  --duration=8760h

# 3. Gerar kubeconfig com esse token:
kubectl config set-credentials dba-readonly --token=<TOKEN>
kubectl config set-context dba-readonly \\
  --cluster=<SEU_CLUSTER> --user=dba-readonly
kubectl config use-context dba-readonly
kubectl config view --flatten > kubeconfig-readonly.yaml

# 4. Upload o kubeconfig-readonly.yaml nesta página`

  const copy = () => {
    navigator.clipboard.writeText(rbacContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-text-primary">RBAC Read-Only — Setup</h2>
            <p className="text-xs text-text-secondary mt-0.5">Permissões mínimas para monitoramento (get, list, watch)</p>
          </div>
          <button onClick={copy}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${copied ? 'bg-emerald-500/10 text-emerald-400' : 'bg-surface-elevated hover:bg-surface-active text-text-secondary'}`}>
            {copied ? <><CheckCircle2 className="w-3.5 h-3.5" /> Copiado!</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
          </button>
        </div>
        <div className="p-5">
          <pre className="text-[11px] leading-relaxed text-emerald-300/80 bg-gray-950 rounded-xl p-4 overflow-x-auto font-mono border border-gray-800">
            {rbacContent}
          </pre>
          <div className="mt-4 p-3 rounded-xl bg-blue-950/30 border border-blue-900/30 text-[11px] text-blue-300/80 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-blue-300 mb-1">O que esse RBAC faz:</p>
              <p>Cria um ServiceAccount com <strong>apenas</strong> verbos get/list/watch. O DBA Analyser <strong>não pode</strong> criar, editar, escalar ou deletar nenhum recurso no seu cluster. O arquivo completo está em <code>demandas/k8s-readonly-rbac.yaml</code>.</p>
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-border flex justify-end">
          <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-elevated rounded-xl transition">
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════
// CLUSTER FORM — Security-hardened
// ═══════════════════════════════════════════════

