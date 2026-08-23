import { HABIT_INFO } from '../lib/petEngine';
import type { HabitKind } from '../types';

interface ActionBarProps {
  disabled: boolean;
  habitsDisabled: boolean;
  doneToday: Record<HabitKind, boolean>;
  onPlay: () => void;
  onRefresh: () => void;
  onRequestHabit: (kind: HabitKind) => void;
  refreshing: boolean;
}

function HabitButton({
  kind,
  disabled,
  doneToday,
  onRequestHabit,
}: {
  kind: HabitKind;
  disabled: boolean;
  doneToday: boolean;
  onRequestHabit: (kind: HabitKind) => void;
}) {
  const info = HABIT_INFO[kind];
  return (
    <button
      className="device-btn"
      disabled={disabled || doneToday}
      onClick={() => onRequestHabit(kind)}
      title={doneToday ? 'Já concluído hoje — disponível de novo amanhã.' : info.flavor}
    >
      {info.icon}
      <span>{info.label}</span>
      <small>{doneToday ? 'Feito hoje ✅' : `${info.costSats.toLocaleString('pt-BR')} sats`}</small>
    </button>
  );
}

export default function ActionBar({
  disabled,
  habitsDisabled,
  doneToday,
  onPlay,
  onRefresh,
  onRequestHabit,
  refreshing,
}: ActionBarProps) {
  return (
    <div className="action-bar">
      <button className="device-btn" disabled={disabled} onClick={onPlay} title="Brincar">
        🎮<span>Brincar</span>
      </button>
      <button className="device-btn" disabled={refreshing} onClick={onRefresh} title="Checar sats recebidos">
        🔄<span>{refreshing ? 'Checando…' : 'Checar sats'}</span>
      </button>
      <HabitButton
        kind="carnivore"
        disabled={disabled || habitsDisabled}
        doneToday={doneToday.carnivore}
        onRequestHabit={onRequestHabit}
      />
      <HabitButton
        kind="austrianSchool"
        disabled={disabled || habitsDisabled}
        doneToday={doneToday.austrianSchool}
        onRequestHabit={onRequestHabit}
      />
      <HabitButton kind="gym" disabled={disabled || habitsDisabled} doneToday={doneToday.gym} onRequestHabit={onRequestHabit} />
    </div>
  );
}
