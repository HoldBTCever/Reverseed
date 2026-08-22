import type { EvolutionStage, Mood, PetState, PetStatus } from '../types';

export const STAGES: EvolutionStage[] = [
  { id: 0, name: 'Ovo de Satoshi', minTotalSats: 0 },
  { id: 1, name: 'Sat-Bebê', minTotalSats: 1 },
  { id: 2, name: 'Sat-Cub', minTotalSats: 10_000 },
  { id: 3, name: 'HODLer Jr.', minTotalSats: 100_000 },
  { id: 4, name: 'Bitcoin Whale', minTotalSats: 1_000_000 },
  { id: 5, name: 'Satoshi Lendário', minTotalSats: 100_000_000 },
];

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

export function createPetState(address: string, isDemo: boolean, now = Date.now()): PetState {
  return {
    address,
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

function pushCapped(list: string[], item: string, max: number): string[] {
  return [item, ...list].slice(0, max);
}
