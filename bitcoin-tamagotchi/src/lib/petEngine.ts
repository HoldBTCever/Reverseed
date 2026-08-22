import type { EvolutionStage, HabitCounts, HabitKind, HabitTimestamps, Mood, PetState, PetStatus, WalletKind } from '../types';

export const STAGES: EvolutionStage[] = [
  {
    id: 0,
    name: 'Plebe Adormecido',
    description: 'Ainda no sistema fiduciário — precisa ser despertado com o primeiro satoshi.',
    minTotalSats: 0,
  },
  {
    id: 1,
    name: 'Recém Orange-Pilled',
    description: 'Acabou de descobrir Bitcoin. A jornada de baixa preferência temporal começa agora.',
    minTotalSats: 1,
  },
  {
    id: 2,
    name: 'Poupador Disciplinado',
    description: 'Trocando consumo imediato por acumulação — construindo o hábito.',
    minTotalSats: 10_000,
  },
  {
    id: 3,
    name: 'Provedor Estável',
    description: 'Já tem onde morar. A base está posta.',
    minTotalSats: 100_000,
  },
  {
    id: 4,
    name: 'Pai de Família Próspero',
    description: 'Casa, família, filhos livres do fiat — as decisões de longo prazo compensaram.',
    minTotalSats: 1_000_000,
  },
  {
    id: 5,
    name: 'Maximalista Lendário',
    description: '1 BTC acumulado. O topo da pirâmide de necessidades, bitcoinizada.',
    minTotalSats: 100_000_000,
  },
];

export const HABIT_KINDS: HabitKind[] = ['carnivore', 'austrianSchool', 'gym'];
export const HABIT_COOLDOWN_MS = 2 * 60 * 60 * 1000;
export const HABIT_BADGE_THRESHOLD = 5;

export const HABIT_INFO: Record<HabitKind, { label: string; flavor: string; icon: string }> = {
  carnivore: { label: 'Dieta Carnívora', flavor: 'Só carne, sal e água.', icon: '🥩' },
  austrianSchool: { label: 'Escola Austríaca', flavor: 'Mises, Hayek, Rothbard, O Padrão Bitcoin.', icon: '📖' },
  gym: { label: 'Treinar', flavor: 'Ficar difícil de matar.', icon: '💪' },
};

const HABIT_EFFECTS: Record<HabitKind, { happiness: number; health: number; energy: number }> = {
  carnivore: { happiness: 6, health: 10, energy: 6 },
  austrianSchool: { happiness: 12, health: 0, energy: -3 },
  gym: { happiness: 8, health: 8, energy: -10 },
};

function emptyHabitCounts(): HabitCounts {
  return { carnivore: 0, austrianSchool: 0, gym: 0 };
}

function emptyHabitTimestamps(): HabitTimestamps {
  return { carnivore: null, austrianSchool: null, gym: null };
}

/** Backfills habits/lastHabitAt on a PetState persisted before those fields existed. */
export function withHabitDefaults(state: PetState): PetState {
  if (state.habits && state.lastHabitAt) return state;
  return {
    ...state,
    habits: state.habits ?? emptyHabitCounts(),
    lastHabitAt: state.lastHabitAt ?? emptyHabitTimestamps(),
  };
}

// Stat points lost per hour of real elapsed time.
const HUNGER_DECAY_PER_HOUR = 4;
const HAPPINESS_DECAY_PER_HOUR = 3;
const ENERGY_DECAY_PER_HOUR = 2.5;
const ENERGY_REGEN_WHILE_SLEEPING_PER_HOUR = 6;
const LOW_HUNGER_HAPPINESS_PENALTY_MULT = 1.8;
const LOW_HUNGER_THRESHOLD = 20;

// Health chases a weighted target of the other three stats.
const HEALTH_CHASE_RATE_PER_HOUR = 0.35;

// Cap how much elapsed time a single tick can account for, so re-opening
// the app after months away doesn't produce a single absurd jump.
const MAX_TICK_HOURS = 30 * 24;

const HIBERNATION_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000;

const MAX_FEED_LOG = 50;
const MAX_SEEN_TXIDS = 300;

export function createPetState(
  walletKind: WalletKind,
  walletLabel: string,
  isDemo: boolean,
  now = Date.now(),
): PetState {
  return {
    walletKind,
    walletLabel,
    isDemo,
    createdAt: now,
    lastTickAt: now,
    seenTxids: [],
    hunger: 70,
    happiness: 70,
    energy: 100,
    health: 100,
    totalSatsFed: 0,
    status: 'alive',
    isSleeping: false,
    lastPlayedAt: null,
    feedLog: [],
    hibernatingSince: null,
    name: 'Satoshi',
    habits: emptyHabitCounts(),
    lastHabitAt: emptyHabitTimestamps(),
  };
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

export function stageForTotalSats(totalSatsFed: number): EvolutionStage {
  let current = STAGES[0];
  for (const stage of STAGES) {
    if (totalSatsFed >= stage.minTotalSats) current = stage;
  }
  return current;
}

export function moodFor(state: PetState): Mood {
  if (state.status === 'gone') return 'gone';
  if (state.status === 'hibernating') return 'hibernating';
  const avg = (state.hunger + state.happiness + state.energy) / 3;
  if (avg >= 70) return 'happy';
  if (avg >= 40) return 'neutral';
  if (avg >= 15) return 'sad';
  return 'critical';
}

/**
 * Advances the pet's stats to `now`, based on elapsed real time since the
 * last tick. Pure — returns a new state, never mutates the input.
 */
export function applyTick(state: PetState, now = Date.now()): PetState {
  if (state.status === 'gone') {
    return { ...state, lastTickAt: now };
  }

  const elapsedHours = Math.min(
    MAX_TICK_HOURS,
    Math.max(0, (now - state.lastTickAt) / (60 * 60 * 1000)),
  );

  if (elapsedHours === 0) return state;

  const hunger = clamp(state.hunger - HUNGER_DECAY_PER_HOUR * elapsedHours);

  const happinessDecayMult = state.hunger < LOW_HUNGER_THRESHOLD ? LOW_HUNGER_HAPPINESS_PENALTY_MULT : 1;
  const happiness = clamp(state.happiness - HAPPINESS_DECAY_PER_HOUR * happinessDecayMult * elapsedHours);

  const energy = state.isSleeping
    ? clamp(state.energy + ENERGY_REGEN_WHILE_SLEEPING_PER_HOUR * elapsedHours)
    : clamp(state.energy - ENERGY_DECAY_PER_HOUR * elapsedHours);

  const healthTarget = hunger * 0.4 + happiness * 0.35 + energy * 0.25;
  const health = clamp(
    state.health + (healthTarget - state.health) * Math.min(1, HEALTH_CHASE_RATE_PER_HOUR * elapsedHours),
  );

  let status: PetStatus = state.status;
  let hibernatingSince = state.hibernatingSince;

  if (status === 'alive' && health <= 0) {
    status = 'hibernating';
    hibernatingSince = now;
  } else if (status === 'hibernating') {
    if (hibernatingSince !== null && now - hibernatingSince > HIBERNATION_TIMEOUT_MS) {
      status = 'gone';
    }
  }

  return {
    ...state,
    hunger,
    happiness,
    energy,
    health,
    status,
    hibernatingSince,
    lastTickAt: now,
  };
}

/** Diminishing-returns curve converting a single payment's sats into stat points. */
export function feedPointsForSats(sats: number): number {
  if (sats <= 0) return 0;
  const raw = Math.log2(sats / 500 + 1) * 6;
  return clamp(raw, 3, 45);
}

/**
 * Applies a real (or demo) incoming payment as a "meal". Idempotent per
 * txid so re-polling the same transaction never double-feeds the pet.
 */
export function applyFeed(state: PetState, txid: string, sats: number, at: number): PetState {
  if (state.status === 'gone') return state;
  if (state.seenTxids.includes(txid)) return state;
  if (sats <= 0) {
    return { ...state, seenTxids: pushCapped(state.seenTxids, txid, MAX_SEEN_TXIDS) };
  }

  const points = feedPointsForSats(sats);
  const wasHibernating = state.status === 'hibernating';

  const hunger = clamp(state.hunger + points);
  const happiness = clamp(state.happiness + points * 0.6);
  const energy = clamp(state.energy + points * 0.3);
  const health = clamp(state.health + (wasHibernating ? 30 : points * 0.2));
  const totalSatsFed = state.totalSatsFed + sats;

  return {
    ...state,
    hunger,
    happiness,
    energy,
    health,
    totalSatsFed,
    status: 'alive',
    hibernatingSince: null,
    seenTxids: pushCapped(state.seenTxids, txid, MAX_SEEN_TXIDS),
    feedLog: [{ txid, sats, at }, ...state.feedLog].slice(0, MAX_FEED_LOG),
  };
}

export function play(state: PetState, now = Date.now()): PetState {
  if (state.status !== 'alive') return state;
  const COOLDOWN_MS = 60 * 60 * 1000;
  if (state.lastPlayedAt && now - state.lastPlayedAt < COOLDOWN_MS) return state;
  return {
    ...state,
    happiness: clamp(state.happiness + 12),
    energy: clamp(state.energy - 4),
    lastPlayedAt: now,
  };
}

export function toggleSleep(state: PetState): PetState {
  if (state.status !== 'alive') return state;
  return { ...state, isSleeping: !state.isSleeping };
}

/** Practices a Bitcoiner-lifestyle habit — a free, cosmetic/mood action that never affects evolution stage. */
export function practiceHabit(state: PetState, kind: HabitKind, now = Date.now()): PetState {
  if (state.status !== 'alive') return state;
  const last = state.lastHabitAt[kind];
  if (last && now - last < HABIT_COOLDOWN_MS) return state;

  const effect = HABIT_EFFECTS[kind];
  return {
    ...state,
    happiness: clamp(state.happiness + effect.happiness),
    health: clamp(state.health + effect.health),
    energy: clamp(state.energy + effect.energy),
    habits: { ...state.habits, [kind]: state.habits[kind] + 1 },
    lastHabitAt: { ...state.lastHabitAt, [kind]: now },
  };
}

export function hasHabitBadge(state: PetState, kind: HabitKind): boolean {
  return state.habits[kind] >= HABIT_BADGE_THRESHOLD;
}

function pushCapped(list: string[], item: string, max: number): string[] {
  return [item, ...list].slice(0, max);
}
