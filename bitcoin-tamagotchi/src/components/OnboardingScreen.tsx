import { useState } from 'react';
import { isValidBitcoinAddress } from '../lib/bitcoinAddress';
import { connectUnisat, isUnisatAvailable } from '../lib/unisat';
import { isValidLightningAddress, resolveLightningAddress } from '../lib/lnurl';
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
  const [lightningAddress, setLightningAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = lightningAddress.trim();
    if (!isValidLightningAddress(trimmed)) {
      setError('Isso não parece um endereço Lightning válido. Confira e tente novamente.');
      return;
    }
    setError(null);
    setVerifying(true);
    try {
      await resolveLightningAddress(trimmed);
      onLink({ kind: 'lightning', lightningAddress: trimmed, isDemo: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível verificar esse endereço.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <>
      <form className="onboarding__form" onSubmit={submit}>
        <label htmlFor="lnaddress-input">Cole seu endereço Lightning (Lightning Address)</label>
        <input
          id="lnaddress-input"
          type="text"
          value={lightningAddress}
          onChange={(e) => setLightningAddress(e.target.value)}
          placeholder="seunome@carteira.com"
          spellCheck={false}
          autoComplete="off"
        />
        {error && <p className="onboarding__error">{error}</p>}
        <button type="submit" className="primary-btn" disabled={verifying}>
          {verifying ? 'Verificando…' : 'Vincular carteira Lightning'}
        </button>
      </form>

      <button className="link-btn" onClick={() => onLink({ kind: 'lightning', lightningAddress: '', isDemo: true })}>
        Experimentar Lightning em modo demonstração
      </button>

      <p className="onboarding__note">
        Um endereço Lightning (como <code>nome@carteira.com</code>) é um identificador público — como um
        e-mail — que qualquer pessoa pode usar para te pagar. Não é preciso compartilhar senha nem chave
        alguma. Como endereços Lightning não têm histórico público, alimentar o pet aqui funciona gerando
        uma fatura para cada pagamento (ou colando uma fatura <code>lnbc...</code> que você já tem).
      </p>
    </>
  );
}

export default function OnboardingScreen({ onLink }: OnboardingScreenProps) {
  const [tab, setTab] = useState<WalletKind>('onchain');

  return (
    <div className="onboarding">
      <div className="onboarding__hero">
        <span className="onboarding__egg">🟠</span>
        <h1>Satoshi Pet</h1>
        <p>
          Um avatar que evolui conforme suas <strong>decisões financeiras de longo prazo</strong>. Vincule
          uma carteira Bitcoin on-chain ou Lightning — apenas para leitura, nunca pedimos custódia — e cada
          satoshi acumulado o aproxima de uma vida construída com baixa preferência temporal: estabilidade,
          família, saúde, liberdade.
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
