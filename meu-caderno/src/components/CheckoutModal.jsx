import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';

export default function CheckoutModal({ isOpen, onClose, user }) {
  const [method, setMethod] = useState('pix');
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState(null);
  const [copied, setCopied] = useState(false);

  // Polling em tempo real (sempre declarado no topo do componente)
  useEffect(() => {
    let interval;

    if (isOpen && pixData?.paymentId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/check-payment?paymentId=${pixData.paymentId}&userId=${user?.uid || user?.email}`);
          const data = await res.json();

          if (data.status === 'approved') {
            clearInterval(interval);
            toast.success('Pagamento confirmado! Bem-vindo ao Pro 🚀');
            onClose();
          }
        } catch (err) {
          console.error('Erro ao verificar pagamento:', err);
        }
      }, 3000);
    }

    return () => clearInterval(interval);
  }, [isOpen, pixData, user, onClose]);

  // Se o modal estiver fechado, interrompe a renderização apenas AQUI (depois de registrar os Hooks)
  if (!isOpen) return null;

  const handleGeneratePix = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/create-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.uid || user?.email,
          email: user?.email,
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar Pix');

      setPixData(data);
    } catch (err) {
      toast.error(err.message || 'Erro ao gerar o Pix');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (pixData?.qrCodeCopyPaste) {
      navigator.clipboard.writeText(pixData.qrCodeCopyPaste);
      setCopied(true);
      toast.success('Código Pix copiado!');
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold text-lg"
        >
          ✕
        </button>

        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4 text-center">
          Seja Membro Pro 🚀
        </h2>

        {/* Abas de Escolha de Pagamento */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mb-6">
          <button
            onClick={() => setMethod('pix')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
              method === 'pix'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            ⚡ Pix (Instantâneo)
          </button>
          <button
            onClick={() => setMethod('card')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
              method === 'card'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            💳 Cartão
          </button>
        </div>

        {/* Aba Pix */}
        {method === 'pix' && (
          <div className="flex flex-col items-center space-y-4">
            {!pixData ? (
              <button
                onClick={handleGeneratePix}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-lg transition disabled:opacity-50"
              >
                {loading ? 'Gerando QR Code...' : 'Gerar QR Code Pix'}
              </button>
            ) : (
              <div className="w-full flex flex-col items-center space-y-4">
                {pixData.qrCodeBase64 && (
                  <img
                    src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                    alt="QR Code Pix"
                    className="w-48 h-48 rounded-xl border border-slate-200 p-2 bg-white"
                  />
                )}
                <button
                  onClick={handleCopy}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2"
                >
                  {copied ? '✅ Copiado!' : '📋 Copiar Código Pix'}
                </button>
                <p className="text-xs text-slate-500 text-center">
                  Abra o app do seu banco, escolha <strong>Pix Copia e Cola</strong> e faça o pagamento. O Pro será liberado automaticamente assim que for confirmado!
                </p>
              </div>
            )}
          </div>
        )}

        {/* Aba Cartão */}
        {method === 'card' && (
          <div className="text-center py-6 text-slate-500 text-sm">
            Em breve suporte a Cartão de Crédito transparente.
          </div>
        )}
      </div>
    </div>
  );
}