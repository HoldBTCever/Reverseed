import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { HABIT_INFO } from '../lib/petEngine';
import { requestLightningInvoice, isInvoiceSettled, type GeneratedInvoice } from '../lib/lnurl';
import { isWebLNAvailable, payWithWebLN } from '../lib/webln';
import { shortenAddress } from '../lib/bitcoinAddress';
import type { PendingHabit, WalletKind } from '../types';

interface HabitPaymentCardProps {
  pendingHabit: PendingHabit;
  walletKind: WalletKind;
  isDemo: boolean;
  lightningAddress: string | null;
  address: string | null;
  onFeed: (id: string, sats: number) => void;
  onCancel: () => void;
}

const VERIFY_POLL_MS = 4_000;
const VERIFY_TIMEOUT_MS = 10 * 60 * 1000;

function LightningHabitInvoice({
  lightningAddress,
  costSats,
  onFeed,
}: {
  lightningAddress: string;
  costSats: number;
  onFeed: (id: string, sats: number) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<GeneratedInvoice | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [settled, setSettled] = useState(false);
  const pollStartedAt = useRef(0);

  useEffect(() => {
    if (!pending?.verifyUrl || settled) return;
    pollStartedAt.current = Date.now();
    const interval = setInterval(async () => {
      if (Date.now() - pollStartedAt.current > VERIFY_TIMEOUT_MS) {
        clearInterval(interval);
        return;
      }
      const ok = await isInvoiceSettled(pending.verifyUrl!);
      if (ok) {
        clearInterval(interval);
        setSettled(true);
        onFeed(pending.invoice, costSats);
      }
    }, VERIFY_POLL_MS);
    return () => clearInterval(interval);
  }, [pending, settled, costSats, onFeed]);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const result = await requestLightningInvoice(lightningAddress, costSats, 'Satoshi Pet — hábito');
      setPending(result);
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

  const payWithExtension = async () => {
    if (!pending) return;
    setPaying(true);
    setError(null);
    try {
      await payWithWebLN(pending.invoice);
      setSettled(true);
      onFeed(pending.invoice, costSats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'O pagamento falhou.');
    } finally {
      setPaying(false);
    }
  };

  const confirmManually = () => {
    if (!pending) return;
    setSettled(true);
    onFeed(pending.invoice, costSats);
  };

  if (!pending) {
    return (
      <div className="lightning-card__form">
        <button className="primary-btn" onClick={generate} disabled={generating}>
          {generating ? 'Gerando…' : `Gerar fatura de ${costSats.toLocaleString('pt-BR')} sats`}
        </button>
        {error && <p className="onboarding__error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="lightning-card__invoice">
      {qrDataUrl && <img className="address-card__qr" src={qrDataUrl} alt="QR code da fatura Lightning" />}
      <div className="address-card__info">
        <code className="address-card__address">
          {pending.invoice.slice(0, 20)}…{pending.invoice.slice(-8)}
        </code>
        <p className="onboarding__note">
          {pending.verifyUrl
            ? '✅ Essa carteira confirma pagamentos automaticamente — aguardando… o hábito completa sozinho assim que a fatura for paga.'
            : '⚠️ Essa carteira não confirma pagamentos automaticamente. Pague e use WebLN, ou peça a alguém para confirmar por você.'}
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
      </div>
    </div>
  );
}

function OnchainHabitTarget({ address, costSats }: { address: string; costSats: number }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(`bitcoin:${address}?amount=${(costSats / 1e8).toFixed(8)}`, {
      width: 180,
      margin: 1,
      color: { dark: '#1a1a2e', light: '#ffffff' },
    }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [address, costSats]);

  return (
    <div className="address-card address-card--plain">
      {qrDataUrl && <img className="address-card__qr" src={qrDataUrl} alt="QR code do endereço vinculado" />}
      <div className="address-card__info">
        <code className="address-card__address">{shortenAddress(address, 8)}</code>
        <p className="onboarding__note">
          Envie pelo menos {costSats.toLocaleString('pt-BR')} sats numa única transação para esta carteira. O hábito completa
          sozinho assim que a rede confirmar (detecção automática, igual à alimentação normal).
        </p>
      </div>
    </div>
  );
}

export default function HabitPaymentCard({
  pendingHabit,
  walletKind,
  isDemo,
  lightningAddress,
  address,
  onFeed,
  onCancel,
}: HabitPaymentCardProps) {
  const info = HABIT_INFO[pendingHabit.kind];

  return (
    <div className="lightning-card">
      <div className="lightning-card__header">
        <span className="address-card__label">Hábito pendente</span>
        <span className="lightning-card__wallet">
          {info.icon} {info.label} · {pendingHabit.costSats.toLocaleString('pt-BR')} sats
        </span>
        <p className="habit-payment__flavor">{info.flavor} Só conta como concluído após o recebimento desse valor em sats.</p>
      </div>

      {isDemo ? (
        <p className="onboarding__note">
          ⏳ Aguardando um aporte simulado de pelo menos {pendingHabit.costSats.toLocaleString('pt-BR')} sats (modo
          demonstração) — chega sozinho em instantes.
        </p>
      ) : walletKind === 'lightning' && lightningAddress ? (
        <LightningHabitInvoice lightningAddress={lightningAddress} costSats={pendingHabit.costSats} onFeed={onFeed} />
      ) : walletKind === 'onchain' && address ? (
        <OnchainHabitTarget address={address} costSats={pendingHabit.costSats} />
      ) : null}

      <button className="link-btn" onClick={onCancel}>
        Cancelar
      </button>
    </div>
  );
}
