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
export const INTELLIGENCE_GLASSES_THRESHOLD = 70;

export const HABIT_INFO: Record<HabitKind, { label: string; flavor: string; icon: string }> = {
  carnivore: { label: 'Dieta Carnívora', flavor: 'Só carne, sal e água — fortalece o corpo.', icon: '🥩' },
  austrianSchool: { label: 'Escola Austríaca', flavor: 'Mises, Hayek, Rothbard — fortalece a mente e a inteligência.', icon: '📖' },
  gym: { label: 'Treinar', flavor: 'Ficar difícil de matar — fortalece o corpo e desestressa.', icon: '💪' },
};

export type StatKey = 'hunger' | 'happiness' | 'energy' | 'physicalHealth' | 'mentalHealth' | 'intelligence';

/** Icon + display label for each stat — the single source used by both the stat bars and the on-action feedback toast. */
export const STAT_META: Record<StatKey, { icon: string; label: string }> = {
  hunger: { icon: '🍗', label: 'Fome' },
  happiness: { icon: '💛', label: 'Felicidade' },
  energy: { icon: '⚡', label: 'Energia' },
  physicalHealth: { icon: '💪', label: 'Saúde Física' },
  mentalHealth: { icon: '🧘', label: 'Saúde Mental' },
  intelligence: { icon: '🧠', label: 'Inteligência' },
};

/** Renders the most significant stat deltas as a short human-readable summary, e.g. "+14 💪 Saúde Física · -10 ⚡ Energia". */
export function describeEffects(deltas: Partial<Record<StatKey, number>>, limit = 2): string {
  return (Object.entries(deltas) as [StatKey, number][])
    .filter(([, delta]) => Math.round(delta) !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, limit)
    .map(([stat, delta]) => {
      const rounded = Math.round(delta);
      const sign = rounded > 0 ? '+' : '';
      return `${sign}${rounded} ${STAT_META[stat].icon} ${STAT_META[stat].label}`;
    })
    .join(' · ');
}

function emptyHabitCounts(): HabitCounts {
  return { carnivore: 0, austrianSchool: 0, gym: 0 };
}

function emptyHabitTimestamps(): HabitTimestamps {
  return { carnivore: null, austrianSchool: null, gym: null };
}

/** Backfills fields on a PetState persisted before they existed (habits, and the physicalHealth/mentalHealth/intelligence split of the old single `health`). */
export function migratePetState(state: PetState): PetState {
  const legacy = state as PetState & { health?: number; isSleeping?: boolean };
  const legacyHealth = legacy.health;
  return {
    ...state,
    habits: state.habits ?? emptyHabitCounts(),
    lastHabitAt: state.lastHabitAt ?? emptyHabitTimestamps(),
    physicalHealth: state.physicalHealth ?? legacyHealth ?? 100,
    mentalHealth: state.mentalHealth ?? legacyHealth ?? 100,
    intelligence: state.intelligence ?? 40,
  };
}

// Stat points lost per hour of real elapsed time.
const HUNGER_DECAY_PER_HOUR = 4;
const HAPPINESS_DECAY_PER_HOUR = 3;
const ENERGY_DECAY_PER_HOUR = 2.5;
const ENERGY_REGEN_WHILE_SLEEPING_PER_HOUR = 6;
const PHYSICAL_HEALTH_DECAY_PER_HOUR = 1.2;
const MENTAL_HEALTH_DECAY_PER_HOUR = 1.2;
const INTELLIGENCE_DECAY_PER_HOUR = 0.3;

const LOW_HUNGER_THRESHOLD = 20;
const LOW_HUNGER_PENALTY_MULT = 1.8; // extra decay on happiness AND physicalHealth while malnourished
const LOW_HAPPINESS_THRESHOLD = 20;
const LOW_HAPPINESS_MENTAL_HEALTH_PENALTY_MULT = 1.6;

// Cap how much elapsed time a single tick can account for, so re-opening
// the app after months away doesn't produce a single absurd jump.
const MAX_TICK_HOURS = 30 * 24;

const HIBERNATION_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000;

const MAX_FEED_LOG = 50;
const MAX_SEEN_TXIDS = 300;

/** Whether it's nighttime in Brazil (America/Sao_Paulo) at the given instant — drives the avatar's sleep cycle automatically. */
export function isNightInBrazil(now: number): boolean {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Sao_Paulo' }).format(now),
  );
  return hour >= 23 || hour < 7;
}

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
    physicalHealth: 100,
    mentalHealth: 100,
    intelligence: 40,
    totalSatsFed: 0,
    status: 'alive',
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
  const avg = (state.hunger + state.happiness + state.energy + state.mentalHealth) / 4;
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

  const lowHunger = state.hunger < LOW_HUNGER_THRESHOLD;
  const happiness = clamp(
    state.happiness - HAPPINESS_DECAY_PER_HOUR * (lowHunger ? LOW_HUNGER_PENALTY_MULT : 1) * elapsedHours,
  );

  const energy = isNightInBrazil(now)
    ? clamp(state.energy + ENERGY_REGEN_WHILE_SLEEPING_PER_HOUR * elapsedHours)
    : clamp(state.energy - ENERGY_DECAY_PER_HOUR * elapsedHours);

  const physicalHealth = clamp(
    state.physicalHealth - PHYSICAL_HEALTH_DECAY_PER_HOUR * (lowHunger ? LOW_HUNGER_PENALTY_MULT : 1) * elapsedHours,
  );

  const lowHappiness = state.happiness < LOW_HAPPINESS_THRESHOLD;
  const mentalHealth = clamp(
    state.mentalHealth -
      MENTAL_HEALTH_DECAY_PER_HOUR * (lowHappiness ? LOW_HAPPINESS_MENTAL_HEALTH_PENALTY_MULT : 1) * elapsedHours,
  );

  const intelligence = clamp(state.intelligence - INTELLIGENCE_DECAY_PER_HOUR * elapsedHours);

  let status: PetStatus = state.status;
  let hibernatingSince = state.hibernatingSince;

  if (status === 'alive' && (physicalHealth <= 0 || mentalHealth <= 0)) {
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
    physicalHealth,
    mentalHealth,
    intelligence,
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

// Multipliers converting feed "points" (see feedPointsForSats) into each stat's gain.
const FEED_HUNGER_MULT = 1;
const FEED_HAPPINESS_MULT = 0.6;
const FEED_ENERGY_MULT = 0.3;
// Real sats mean financial security — mostly relieves mental stress, with a smaller physical benefit (better food, care).
const FEED_PHYSICAL_HEALTH_MULT = 0.25;
const FEED_MENTAL_HEALTH_MULT = 0.4;
const FEED_REVIVE_HEALTH_BOOST = 25;

/** Unclamped stat deltas a payment of this size would apply — used to show the player what a feed actually did. */
export function feedEffectDeltas(sats: number, wasHibernating: boolean) {
  const points = feedPointsForSats(sats);
  return {
    hunger: points * FEED_HUNGER_MULT,
    happiness: points * FEED_HAPPINESS_MULT,
    energy: points * FEED_ENERGY_MULT,
    physicalHealth: wasHibernating ? FEED_REVIVE_HEALTH_BOOST : points * FEED_PHYSICAL_HEALTH_MULT,
    mentalHealth: wasHibernating ? FEED_REVIVE_HEALTH_BOOST : points * FEED_MENTAL_HEALTH_MULT,
  };
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

  const wasHibernating = state.status === 'hibernating';
  const deltas = feedEffectDeltas(sats, wasHibernating);

  const hunger = clamp(state.hunger + deltas.hunger);
  const happiness = clamp(state.happiness + deltas.happiness);
  const energy = clamp(state.energy + deltas.energy);
  const physicalHealth = clamp(state.physicalHealth + deltas.physicalHealth);
  const mentalHealth = clamp(state.mentalHealth + deltas.mentalHealth);
  const totalSatsFed = state.totalSatsFed + sats;

  return {
    ...state,
    hunger,
    happiness,
    energy,
    physicalHealth,
    mentalHealth,
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

/** Each habit's stat deltas — the single source of truth for both applying the habit and telling the player what it did. */
export const HABIT_STAT_EFFECTS: Record<HabitKind, Partial<Record<StatKey, number>>> = {
  carnivore: { hunger: 8, physicalHealth: 12, energy: 4 },
  austrianSchool: { intelligence: 14, mentalHealth: 8, happiness: 4, energy: -3 },
  gym: { physicalHealth: 14, mentalHealth: 6, happiness: 4, energy: -10 },
};

/** Practices a Bitcoiner-lifestyle habit — a free action that never affects evolution stage, only stats and cosmetic badges. */
export function practiceHabit(state: PetState, kind: HabitKind, now = Date.now()): PetState {
  if (state.status !== 'alive') return state;
  const last = state.lastHabitAt[kind];
  if (last && now - last < HABIT_COOLDOWN_MS) return state;

  const effects = HABIT_STAT_EFFECTS[kind];
  const next: PetState = { ...state };
  for (const [stat, delta] of Object.entries(effects) as [StatKey, number][]) {
    next[stat] = clamp(state[stat] + delta);
  }

  return {
    ...next,
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
