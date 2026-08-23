import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { shortenAddress } from '../lib/bitcoinAddress';

interface AddressCardProps {
  address: string;
  isDemo: boolean;
  balanceSats: number | null;
}

export default function AddressCard({ address, isDemo, balanceSats }: AddressCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isDemo) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(`bitcoin:${address}`, { width: 180, margin: 1, color: { dark: '#1a1a2e', light: '#ffffff' } })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [address, isDemo]);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable — user can still select the text manually.
    }
  };

  return (
    <div className="address-card">
      {qrDataUrl && <img className="address-card__qr" src={qrDataUrl} alt="QR code do endereço vinculado" />}
      <div className="address-card__info">
        <span className="address-card__label">{isDemo ? 'Modo demonstração' : 'Endereço vinculado'}</span>
        <code className="address-card__address">{shortenAddress(address, 8)}</code>
        {balanceSats !== null && (
          <span className="address-card__balance">
            {balanceSats.toLocaleString('pt-BR')} sats ({(balanceSats / 1e8).toFixed(8)} BTC)
          </span>
        )}
        {!isDemo && (
          <button className="link-btn" onClick={copyAddress}>
            {copied ? 'Copiado!' : 'Copiar endereço'}
          </button>
        )}
      </div>
    </div>
  );
}
