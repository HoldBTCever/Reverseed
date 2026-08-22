import { useState } from 'react';
import QRCode from 'qrcode';
import { makeLightningInvoice } from '../lib/nwc';

interface LightningCardProps {
  walletLabel: string;
  isDemo: boolean;
  nwcUri: string | null;
  balanceSats: number | null;
}

export default function LightningCard({ walletLabel, isDemo, nwcUri, balanceSats }: LightningCardProps) {
  const [amount, setAmount] = useState('1000');
  const [invoice, setInvoice] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateInvoice = async () => {
    if (!nwcUri) return;
    const sats = Math.round(Number(amount));
    if (!Number.isFinite(sats) || sats <= 0) {
      setError('Informe um valor em sats maior que zero.');
      return;
    }
    setGenerating(true);
    setError(null);
    setInvoice(null);
    setQrDataUrl(null);
    try {
      const bolt11 = await makeLightningInvoice(nwcUri, sats, 'Alimentar Satoshi Pet');
      setInvoice(bolt11);
      const url = await QRCode.toDataURL(`lightning:${bolt11}`, {
        width: 200,
        margin: 1,
        color: { dark: '#1a1a2e', light: '#ffffff' },
      });
      setQrDataUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível gerar a fatura.');
    } finally {
      setGenerating(false);
    }
  };

  const copyInvoice = async () => {
    if (!invoice) return;
    try {
      await navigator.clipboard.writeText(invoice);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable — user can still select the text manually.
    }
  };

  return (
    <div className="lightning-card">
      <div className="lightning-card__header">
        <span className="address-card__label">{isDemo ? 'Modo demonstração' : 'Carteira Lightning vinculada'}</span>
        <span className="lightning-card__wallet">⚡ {walletLabel}</span>
        {balanceSats !== null && (
          <span className="address-card__balance">
            {balanceSats.toLocaleString('pt-BR')} sats ({(balanceSats / 1e8).toFixed(8)} BTC)
          </span>
        )}
      </div>

      {isDemo ? (
        <p className="onboarding__note">
          Pagamentos simulados chegam automaticamente para alimentar o pet — não é preciso gerar fatura aqui.
        </p>
      ) : (
        <div className="lightning-card__invoice">
          {qrDataUrl && invoice ? (
            <>
              <img className="address-card__qr" src={qrDataUrl} alt="QR code da fatura Lightning" />
              <div className="address-card__info">
                <code className="address-card__address">{invoice.slice(0, 20)}…{invoice.slice(-8)}</code>
                <button className="link-btn" onClick={copyInvoice}>
                  {copied ? 'Copiado!' : 'Copiar fatura'}
                </button>
                <button className="link-btn" onClick={generateInvoice}>
                  Gerar outra
                </button>
              </div>
            </>
          ) : (
            <div className="lightning-card__form">
              <label htmlFor="invoice-amount">Gerar fatura para alimentar (sats)</label>
              <div className="lightning-card__amount-row">
                <input
                  id="invoice-amount"
                  type="number"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <button className="primary-btn" onClick={generateInvoice} disabled={generating}>
                  {generating ? 'Gerando…' : 'Gerar fatura'}
                </button>
              </div>
            </div>
          )}
          {error && <p className="onboarding__error">{error}</p>}
        </div>
      )}
    </div>
  );
}
