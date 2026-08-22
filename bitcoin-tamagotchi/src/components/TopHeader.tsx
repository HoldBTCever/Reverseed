interface TopHeaderProps {
  petName: string;
  stageName: string;
  onUnlink: () => void;
  onReset: () => void;
}

export default function TopHeader({ petName, stageName, onUnlink, onReset }: TopHeaderProps) {
  return (
    <header className="top-header">
      <div>
        <h1>{petName}</h1>
        <p className="top-header__stage">{stageName}</p>
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
