import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { requestLightningInvoice, isInvoiceSettled, type GeneratedInvoice } from '../lib/lnurl';
import { decodeBolt11 } from '../lib/bolt11';
import { isWebLNAvailable, payWithWebLN } from '../lib/webln';

interface LightningCardProps {
  walletLabel: string;
  isDemo: boolean;
  lightningAddress: string | null;
  balanceSats: number | null;
  onFeed: (id: string, sats: number) => void;
}

const VERIFY_POLL_MS = 4_000;
const VERIFY_TIMEOUT_MS = 10 * 60 * 1000;
const PRESET_AMOUNTS = [1_000, 5_000, 21_000, 100_000];

function GenerateInvoiceSection({ lightningAddress, onFeed }: { lightningAddress: string; onFeed: (id: string, sats: number) => void }) {
  const [amount, setAmount] = useState('1000');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<GeneratedInvoice | null>(null);
  const [pendingSats, setPendingSats] = useState(0);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [settled, setSettled] = useState<'unpaid' | 'verified' | 'unverified'>('unpaid');
  const [copied, setCopied] = useState(false);
  const [paying, setPaying] = useState(false);
  const pollStartedAt = useRef(0);

  useEffect(() => {
    if (!pending?.verifyUrl || settled !== 'unpaid') return;
    pollStartedAt.current = Date.now();
    const interval = setInterval(async () => {
      if (Date.now() - pollStartedAt.current > VERIFY_TIMEOUT_MS) {
        clearInterval(interval);
        return;
      }
      const ok = await isInvoiceSettled(pending.verifyUrl!);
      if (ok) {
        clearInterval(interval);
        setSettled('verified');
        onFeed(pending.invoice, pendingSats);
      }
    }, VERIFY_POLL_MS);
    return () => clearInterval(interval);
  }, [pending, settled, pendingSats, onFeed]);

  const generate = async () => {
    const sats = Math.round(Number(amount));
    if (!Number.isFinite(sats) || sats <= 0) {
      setError('Informe um valor em sats maior que zero.');
      return;
    }
    setGenerating(true);
    setError(null);
    setPending(null);
    setQrDataUrl(null);
    setSettled('unpaid');
    try {
      const result = await requestLightningInvoice(lightningAddress, sats, 'Alimentar Satoshi Pet');
      setPending(result);
      setPendingSats(sats);
      const url = await QRCode.toDataURL(`lightning:${result.invoice}`, {
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
    if (!pending) return;
    try {
      await navigator.clipboard.writeText(pending.invoice);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable — user can still select the text manually.
    }
  };

  const payWithExtension = async () => {
    if (!pending) return;
    setPaying(true);
    setError(null);
    try {
      await payWithWebLN(pending.invoice);
      setSettled('verified');
      onFeed(pending.invoice, pendingSats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'O pagamento falhou.');
    } finally {
      setPaying(false);
    }
  };

  const confirmManually = () => {
    if (!pending) return;
    setSettled('unverified');
    onFeed(pending.invoice, pendingSats);
  };

  if (settled === 'verified') {
    return <p className="onboarding__note">✅ Pagamento confirmado! {pendingSats.toLocaleString('pt-BR')} sats alimentaram o pet.</p>;
  }
  if (settled === 'unverified') {
    return (
      <p className="onboarding__note">
        🍖 {pendingSats.toLocaleString('pt-BR')} sats registrados (confirmado manualmente, sem verificação).
      </p>
    );
  }

  if (pending && qrDataUrl) {
    return (
      <div className="lightning-card__invoice">
        <img className="address-card__qr" src={qrDataUrl} alt="QR code da fatura Lightning" />
        <div className="address-card__info">
          <code className="address-card__address">
            {pending.invoice.slice(0, 20)}…{pending.invoice.slice(-8)}
          </code>
          <span className="address-card__balance">{pendingSats.toLocaleString('pt-BR')} sats</span>
          <button className="link-btn" onClick={copyInvoice}>
            {copied ? 'Copiado!' : 'Copiar fatura'}
          </button>
          <p className="onboarding__note">
            {pending.verifyUrl
              ? '✅ Essa carteira confirma pagamentos automaticamente — aguardando… o pet come sozinho assim que a fatura for paga.'
              : '⚠️ Essa carteira não confirma pagamentos automaticamente. Pague e confirme manualmente abaixo, ou use uma carteira com extensão WebLN.'}
          </p>
          {error && <p className="onboarding__error">{error}</p>}
          {isWebLNAvailable() && (
            <button className="primary-btn" onClick={payWithExtension} disabled={paying}>
              {paying ? 'Pagando…' : 'Pagar com carteira (verificado)'}
            </button>
          )}
          <button className="link-btn" onClick={confirmManually}>
            ⚠️ Já paguei (marcar sem verificação)
          </button>
          <button className="link-btn" onClick={() => setPending(null)}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lightning-card__form">
      <label htmlFor="invoice-amount">Gerar fatura para alimentar (sats)</label>
      <div className="lightning-card__presets">
        {PRESET_AMOUNTS.map((preset) => (
          <button
            key={preset}
            type="button"
            className={`lightning-card__preset ${amount === String(preset) ? 'lightning-card__preset--active' : ''}`}
            onClick={() => setAmount(String(preset))}
          >
            {preset.toLocaleString('pt-BR')}
          </button>
        ))}
      </div>
      <div className="lightning-card__amount-row">
        <input id="invoice-amount" type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <button className="primary-btn" onClick={generate} disabled={generating}>
          {generating ? 'Gerando…' : 'Gerar fatura'}
        </button>
      </div>
      {error && <p className="onboarding__error">{error}</p>}
    </div>
  );
}

function PasteInvoiceSection({ onFeed }: { onFeed: (id: string, sats: number) => void }) {
  const [raw, setRaw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [fed, setFed] = useState<'no' | 'verified' | 'unverified'>('no');

  let decoded: ReturnType<typeof decodeBolt11> | null = null;
  if (raw.trim()) {
    try {
      decoded = decodeBolt11(raw);
    } catch {
      decoded = null;
    }
  }

  const payWithExtension = async () => {
    if (!decoded) return;
    setPaying(true);
    setError(null);
    try {
      await payWithWebLN(raw.trim());
      onFeed(decoded.paymentHash, decoded.amountSats);
      setFed('verified');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'O pagamento falhou.');
    } finally {
      setPaying(false);
    }
  };

  const confirmManually = () => {
    if (!decoded) return;
    onFeed(decoded.paymentHash, decoded.amountSats);
    setFed('unverified');
  };

  if (fed === 'verified') {
    return <p className="onboarding__note">✅ Pagamento confirmado! Pet alimentado.</p>;
  }
  if (fed === 'unverified') {
    return <p className="onboarding__note">🍖 Registrado (confirmado manualmente, sem verificação).</p>;
  }

  return (
    <div className="lightning-card__form">
      <label htmlFor="paste-invoice">Ou cole uma fatura que você já tem (lnbc...)</label>
      <textarea
        id="paste-invoice"
        rows={2}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="lnbc..."
        spellCheck={false}
      />
      {raw.trim() && !decoded && <p className="onboarding__error">Fatura inválida ou sem valor definido.</p>}
      {decoded && (
        <>
          <span className="address-card__balance">{decoded.amountSats.toLocaleString('pt-BR')} sats</span>
          {error && <p className="onboarding__error">{error}</p>}
          <div className="lightning-card__amount-row">
            {isWebLNAvailable() && (
              <button className="primary-btn" onClick={payWithExtension} disabled={paying}>
                {paying ? 'Pagando…' : 'Pagar com carteira (verificado)'}
              </button>
            )}
            <button className="link-btn" onClick={confirmManually}>
              ⚠️ Já paguei (marcar sem verificação)
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function LightningCard({ walletLabel, isDemo, lightningAddress, balanceSats, onFeed }: LightningCardProps) {
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

      {isDemo || !lightningAddress ? (
        <p className="onboarding__note">
          Pagamentos simulados chegam automaticamente para alimentar o pet — não é preciso gerar fatura aqui.
        </p>
      ) : (
        <>
          <GenerateInvoiceSection lightningAddress={lightningAddress} onFeed={onFeed} />
          <PasteInvoiceSection onFeed={onFeed} />
        </>
      )}
    </div>
  );
}
