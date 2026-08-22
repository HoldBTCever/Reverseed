interface ActionBarProps {
  disabled: boolean;
  isSleeping: boolean;
  onPlay: () => void;
  onToggleSleep: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}

export default function ActionBar({ disabled, isSleeping, onPlay, onToggleSleep, onRefresh, refreshing }: ActionBarProps) {
  return (
    <div className="action-bar">
      <button className="device-btn" disabled={disabled} onClick={onPlay} title="Brincar">
        🎮<span>Brincar</span>
      </button>
      <button className="device-btn" disabled={disabled} onClick={onToggleSleep} title="Dormir">
        {isSleeping ? '☀️' : '🌙'}<span>{isSleeping ? 'Acordar' : 'Dormir'}</span>
      </button>
      <button className="device-btn" disabled={refreshing} onClick={onRefresh} title="Checar sats recebidos">
        🔄<span>{refreshing ? 'Checando…' : 'Checar sats'}</span>
      </button>
    </div>
  );
}
