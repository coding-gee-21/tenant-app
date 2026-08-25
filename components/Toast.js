import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle, Info, X, XCircle } from 'lucide-react';

const ToastContext = createContext({ showToast: () => {} });

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((items) => [...items, { id, message, type }]);
    setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 3500);
  }, []);
  const value = useMemo(() => ({ showToast }), [showToast]);

  return <ToastContext.Provider value={value}>{children}<div className="fixed right-4 top-20 z-[100] w-[min(22rem,calc(100vw-2rem))] space-y-2">{toasts.map((toast) => { const Icon = toast.type === 'error' ? XCircle : toast.type === 'info' ? Info : CheckCircle; return <div key={toast.id} role="status" className={`flex items-start gap-3 rounded-xl border p-4 shadow-2xl backdrop-blur-xl ${toast.type === 'error' ? 'border-red-500/30 bg-red-950/95 text-red-200' : 'border-emerald-500/30 bg-[#121815]/95 text-emerald-200'}`}><Icon size={19} className="mt-0.5 shrink-0" /><p className="flex-1 text-sm">{toast.message}</p><button onClick={() => setToasts((items) => items.filter((item) => item.id !== toast.id))} aria-label="Dismiss notification"><X size={16} /></button></div>; })}</div></ToastContext.Provider>;
}

export const useToast = () => useContext(ToastContext);

