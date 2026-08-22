import { HABIT_INFO } from '../lib/petEngine';
import type { HabitKind } from '../types';

interface ActionBarProps {
  disabled: boolean;
  isSleeping: boolean;
  onPlay: () => void;
  onToggleSleep: () => void;
  onRefresh: () => void;
  onHabit: (kind: HabitKind) => void;
  refreshing: boolean;
}

export default function ActionBar({
  disabled,
  isSleeping,
  onPlay,
  onToggleSleep,
  onRefresh,
  onHabit,
  refreshing,
}: ActionBarProps) {
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
      <button
        className="device-btn"
        disabled={disabled}
        onClick={() => onHabit('carnivore')}
        title={HABIT_INFO.carnivore.flavor}
      >
        {HABIT_INFO.carnivore.icon}<span>{HABIT_INFO.carnivore.label}</span>
      </button>
      <button
        className="device-btn"
        disabled={disabled}
        onClick={() => onHabit('austrianSchool')}
        title={HABIT_INFO.austrianSchool.flavor}
      >
        {HABIT_INFO.austrianSchool.icon}<span>{HABIT_INFO.austrianSchool.label}</span>
      </button>
      <button className="device-btn" disabled={disabled} onClick={() => onHabit('gym')} title={HABIT_INFO.gym.flavor}>
        {HABIT_INFO.gym.icon}<span>{HABIT_INFO.gym.label}</span>
      </button>
    </div>
  );
}
