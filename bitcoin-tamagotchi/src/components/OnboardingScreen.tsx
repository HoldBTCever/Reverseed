import { useState } from 'react';
import { isValidBitcoinAddress } from '../lib/bitcoinAddress';
import { connectUnisat, isUnisatAvailable } from '../lib/unisat';
import { getDemoAddress } from '../lib/demoWallet';

interface OnboardingScreenProps {
  onLink: (address: string, isDemo: boolean) => void;
}

export default function OnboardingScreen({ onLink }: OnboardingScreenProps) {
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const submitAddress = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = address.trim();
    if (!isValidBitcoinAddress(trimmed)) {
      setError('Isso não parece um endereço Bitcoin válido. Confira e tente novamente.');
      return;
    }
    setError(null);
    onLink(trimmed, false);
  };

  const connectWallet = async () => {
    setConnecting(true);
    setError(null);
    try {
      const connected = await connectUnisat();
      onLink(connected, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível conectar a carteira.');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="onboarding">
      <div className="onboarding__hero">
        <span className="onboarding__egg">🥚</span>
        <h1>Satoshi Pet</h1>
        <p>
          Um bichinho virtual que só cresce se você o alimentar com <strong>satoshis de verdade</strong>.
          Vincule um endereço Bitcoin — apenas para leitura, nunca pedimos sua chave privada — e cada
          pagamento recebido vira uma refeição.
        </p>
      </div>

      {isUnisatAvailable() && (
        <button className="primary-btn" onClick={connectWallet} disabled={connecting}>
          {connecting ? 'Conectando…' : '🔗 Conectar carteira (Unisat)'}
        </button>
      )}

      <form className="onboarding__form" onSubmit={submitAddress}>
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
          Vincular carteira
        </button>
      </form>

      <button className="link-btn" onClick={() => onLink(getDemoAddress(), true)}>
        Experimentar em modo demonstração (sem carteira real)
      </button>

      <p className="onboarding__note">
        Só lemos dados públicos do endereço (saldo e transações) em exploradores de blocos abertos.
        Nunca solicitamos nem armazenamos chaves privadas ou frases de recuperação.
      </p>
    </div>
  );
}
