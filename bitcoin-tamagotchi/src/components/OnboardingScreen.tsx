import { useState } from 'react';
import { isValidBitcoinAddress } from '../lib/bitcoinAddress';
import { connectUnisat, isUnisatAvailable } from '../lib/unisat';
import { isValidNwcUri } from '../lib/nwc';
import type { LinkedWallet, WalletKind } from '../types';

interface OnboardingScreenProps {
  onLink: (wallet: LinkedWallet) => void;
}

function OnchainTab({ onLink }: { onLink: (wallet: LinkedWallet) => void }) {
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = address.trim();
    if (!isValidBitcoinAddress(trimmed)) {
      setError('Isso não parece um endereço Bitcoin válido. Confira e tente novamente.');
      return;
    }
    setError(null);
    onLink({ kind: 'onchain', address: trimmed, isDemo: false });
  };

  const connectWallet = async () => {
    setConnecting(true);
    setError(null);
    try {
      const connected = await connectUnisat();
      onLink({ kind: 'onchain', address: connected, isDemo: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível conectar a carteira.');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <>
      {isUnisatAvailable() && (
        <button className="primary-btn" onClick={connectWallet} disabled={connecting}>
          {connecting ? 'Conectando…' : '🔗 Conectar carteira (Unisat)'}
        </button>
      )}

      <form className="onboarding__form" onSubmit={submit}>
        <label htmlFor="address-input">Ou cole um endereço Bitcoin (bc1…, 1…, 3…)</label>
        <input
          id="address-input"
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="bc1q..."
          spellCheck={false}
          autoComplete="off"
        />
        {error && <p className="onboarding__error">{error}</p>}
        <button type="submit" className="primary-btn">
          Vincular carteira on-chain
        </button>
      </form>

      <button className="link-btn" onClick={() => onLink({ kind: 'onchain', address: '', isDemo: true })}>
        Experimentar on-chain em modo demonstração
      </button>

      <p className="onboarding__note">
        Só lemos dados públicos do endereço (saldo e transações) em exploradores de blocos abertos.
        Nunca solicitamos nem armazenamos chaves privadas ou frases de recuperação.
      </p>
    </>
  );
}

function LightningTab({ onLink }: { onLink: (wallet: LinkedWallet) => void }) {
  const [nwcUri, setNwcUri] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nwcUri.trim();
    if (!isValidNwcUri(trimmed)) {
      setError('Isso não parece uma string de conexão NWC válida. Confira e tente novamente.');
      return;
    }
    setError(null);
    onLink({ kind: 'lightning', nwcUri: trimmed, isDemo: false });
  };

  return (
    <>
      <form className="onboarding__form" onSubmit={submit}>
        <label htmlFor="nwc-input">Cole a string de conexão Nostr Wallet Connect (NWC)</label>
        <input
          id="nwc-input"
          type="text"
          value={nwcUri}
          onChange={(e) => setNwcUri(e.target.value)}
          placeholder="nostr+walletconnect://..."
          spellCheck={false}
          autoComplete="off"
        />
        {error && <p className="onboarding__error">{error}</p>}
        <button type="submit" className="primary-btn">
          Vincular carteira Lightning
        </button>
      </form>

      <button className="link-btn" onClick={() => onLink({ kind: 'lightning', nwcUri: '', isDemo: true })}>
        Experimentar Lightning em modo demonstração
      </button>

      <p className="onboarding__note">
        NWC é um padrão aberto suportado por Alby, Mutiny, Zeus e outras carteiras Lightning para dar
        acesso limitado a um app, sem entregar custódia. Gere a conexão no app da sua carteira e conceda
        apenas as permissões de leitura (saldo e transações) — <strong>trate essa string como uma senha</strong>,
        pois ela concede exatamente o que você autorizar. Revogue o acesso a qualquer momento no app da
        sua carteira.
      </p>
    </>
  );
}

export default function OnboardingScreen({ onLink }: OnboardingScreenProps) {
  const [tab, setTab] = useState<WalletKind>('onchain');

  return (
    <div className="onboarding">
      <div className="onboarding__hero">
        <span className="onboarding__egg">🥚</span>
        <h1>Satoshi Pet</h1>
        <p>
          Um bichinho virtual que só cresce se você o alimentar com <strong>satoshis de verdade</strong>.
          Vincule uma carteira Bitcoin on-chain ou Lightning — apenas para leitura, nunca pedimos custódia
          — e cada pagamento recebido vira uma refeição.
        </p>
      </div>

      <div className="onboarding__tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'onchain'}
          className={`onboarding__tab ${tab === 'onchain' ? 'onboarding__tab--active' : ''}`}
          onClick={() => setTab('onchain')}
        >
          ⛓️ On-chain
        </button>
        <button
          role="tab"
          aria-selected={tab === 'lightning'}
          className={`onboarding__tab ${tab === 'lightning' ? 'onboarding__tab--active' : ''}`}
          onClick={() => setTab('lightning')}
        >
          ⚡ Lightning
        </button>
      </div>

      {tab === 'onchain' ? <OnchainTab onLink={onLink} /> : <LightningTab onLink={onLink} />}
    </div>
  );
}
