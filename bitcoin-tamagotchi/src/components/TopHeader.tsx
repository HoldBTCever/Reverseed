import type { WalletKind } from '../types';

interface TopHeaderProps {
  petName: string;
  stageName: string;
  walletKind: WalletKind;
  onUnlink: () => void;
  onReset: () => void;
}

export default function TopHeader({ petName, stageName, walletKind, onUnlink, onReset }: TopHeaderProps) {
  return (
    <header className="top-header">
      <div>
        <h1>{petName}</h1>
        <p className="top-header__stage">
          {stageName} <span className="top-header__badge">{walletKind === 'onchain' ? '⛓️ On-chain' : '⚡ Lightning'}</span>
        </p>
      </div>
      <div className="top-header__actions">
        <button className="link-btn" onClick={onReset} title="Recomeçar o pet (mantém a carteira vinculada)">
          Recomeçar
        </button>
        <button className="link-btn" onClick={onUnlink} title="Desvincular carteira">
          Desvincular
        </button>
      </div>
    </header>
  );
}
