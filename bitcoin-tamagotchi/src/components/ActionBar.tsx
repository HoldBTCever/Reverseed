import { HABIT_INFO } from '../lib/petEngine';
import type { HabitKind } from '../types';

interface ActionBarProps {
  disabled: boolean;
  habitsDisabled: boolean;
  onPlay: () => void;
  onRefresh: () => void;
  onRequestHabit: (kind: HabitKind) => void;
  refreshing: boolean;
}

function HabitButton({
  kind,
  disabled,
  onRequestHabit,
}: {
  kind: HabitKind;
  disabled: boolean;
  onRequestHabit: (kind: HabitKind) => void;
}) {
  const info = HABIT_INFO[kind];
  return (
    <button className="device-btn" disabled={disabled} onClick={() => onRequestHabit(kind)} title={info.flavor}>
      {info.icon}
      <span>{info.label}</span>
      <small>{info.costSats.toLocaleString('pt-BR')} sats</small>
    </button>
  );
}

export default function ActionBar({ disabled, habitsDisabled, onPlay, onRefresh, onRequestHabit, refreshing }: ActionBarProps) {
  return (
    <div className="action-bar">
      <button className="device-btn" disabled={disabled} onClick={onPlay} title="Brincar">
        🎮<span>Brincar</span>
      </button>
      <button className="device-btn" disabled={refreshing} onClick={onRefresh} title="Checar sats recebidos">
        🔄<span>{refreshing ? 'Checando…' : 'Checar sats'}</span>
      </button>
      <HabitButton kind="carnivore" disabled={disabled || habitsDisabled} onRequestHabit={onRequestHabit} />
      <HabitButton kind="austrianSchool" disabled={disabled || habitsDisabled} onRequestHabit={onRequestHabit} />
      <HabitButton kind="gym" disabled={disabled || habitsDisabled} onRequestHabit={onRequestHabit} />
    </div>
  );
}
