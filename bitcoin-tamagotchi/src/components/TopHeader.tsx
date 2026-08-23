import type { WalletKind } from '../types';

interface TopHeaderProps {
  petName: string;
  stageName: string;
  stageDescription: string;
  walletKind: WalletKind;
  onUnlink: () => void;
  onReset: () => void;
}

export default function TopHeader({ petName, stageName, stageDescription, walletKind, onUnlink, onReset }: TopHeaderProps) {
  return (
    <header className="top-header">
      <div>
        <h1>{petName}</h1>
        <p className="top-header__stage">
          {stageName} <span className="top-header__badge">{walletKind === 'onchain' ? '⛓️ On-chain' : '⚡ Lightning'}</span>
        </p>
        <p className="top-header__description">{stageDescription}</p>
      </div>
      <div className="top-header__actions">
        <button className="link-btn" onClick={onReset} title="Recomeçar o avatar (mantém a carteira vinculada)">
          Recomeçar
        </button>
        <button className="link-btn" onClick={onUnlink} title="Desvincular carteira">
          Desvincular
        </button>
      </div>
    </header>
  );
}
