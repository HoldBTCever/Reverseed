import { describe, expect, it } from 'vitest';
import {
  applyFeed,
  applyTick,
  createPetState,
  describeEffects,
  feedEffectDeltas,
  feedPointsForSats,
  HABIT_BADGE_THRESHOLD,
  HABIT_COOLDOWN_MS,
  HABIT_STAT_EFFECTS,
  hasHabitBadge,
  isNightInBrazil,
  moodFor,
  practiceHabit,
  stageForTotalSats,
} from '../lib/petEngine';

const ADDRESS = 'bc1qtestaddress0000000000000000000000000';
const HOUR = 60 * 60 * 1000;

describe('stageForTotalSats', () => {
  it('starts still asleep in the fiat system', () => {
    expect(stageForTotalSats(0).name).toBe('Plebe Adormecido');
  });

  it('wakes up after any sats are fed', () => {
    expect(stageForTotalSats(1).name).toBe('Recém Orange-Pilled');
  });

  it('evolves through thresholds', () => {
    expect(stageForTotalSats(10_000).name).toBe('Poupador Disciplinado');
    expect(stageForTotalSats(100_000).name).toBe('Provedor Estável');
    expect(stageForTotalSats(1_000_000).name).toBe('Pai de Família Próspero');
    expect(stageForTotalSats(100_000_000).name).toBe('Maximalista Lendário');
  });

  it('never regresses below the highest threshold reached', () => {
    expect(stageForTotalSats(99_999).name).toBe('Poupador Disciplinado');
  });
});

describe('feedPointsForSats', () => {
  it('gives zero points for zero or negative sats', () => {
    expect(feedPointsForSats(0)).toBe(0);
    expect(feedPointsForSats(-100)).toBe(0);
  });

  it('has a floor for dust payments and a cap for large ones', () => {
    expect(feedPointsForSats(1)).toBeGreaterThanOrEqual(3);
    expect(feedPointsForSats(10_000_000)).toBeLessThanOrEqual(45);
  });

  it('rewards larger payments with more points, up to the cap', () => {
    const small = feedPointsForSats(1_000);
    const medium = feedPointsForSats(10_000);
    const large = feedPointsForSats(100_000);
    expect(medium).toBeGreaterThan(small);
    expect(large).toBeGreaterThan(medium);
  });

  it('gives diminishing marginal points for the same fixed increment as the base grows', () => {
    const marginalAt = (base: number, increment: number) =>
      feedPointsForSats(base + increment) - feedPointsForSats(base);
    const marginalLow = marginalAt(1_000, 1_000);
    const marginalHigh = marginalAt(50_000, 1_000);
    expect(marginalHigh).toBeLessThan(marginalLow);
  });
});

describe('applyTick', () => {
  it('decays hunger, happiness and energy over elapsed time', () => {
    const now = Date.now();
    const state = createPetState('onchain', ADDRESS, false, now);
    const ticked = applyTick(state, now + 3 * HOUR);
    expect(ticked.hunger).toBeLessThan(state.hunger);
    expect(ticked.happiness).toBeLessThan(state.happiness);
    expect(ticked.energy).toBeLessThan(state.energy);
    expect(ticked.lastTickAt).toBe(now + 3 * HOUR);
  });

  it('is a no-op when no time has elapsed', () => {
    const now = Date.now();
    const state = createPetState('onchain', ADDRESS, false, now);
    expect(applyTick(state, now)).toEqual(state);
  });

  it('regenerates energy automatically during nighttime hours in Brazil instead of draining it', () => {
    // 02:00 in America/Sao_Paulo (UTC-3, fixed year-round) = 05:00 UTC.
    const now = new Date('2024-06-01T05:00:00Z').getTime();
    const state = { ...createPetState('onchain', ADDRESS, false, now), energy: 50 };
    const ticked = applyTick(state, now + 2 * HOUR);
    expect(ticked.energy).toBeGreaterThan(state.energy);
  });

  it('drains energy during daytime hours in Brazil', () => {
    // 14:00 in America/Sao_Paulo = 17:00 UTC.
    const now = new Date('2024-06-01T17:00:00Z').getTime();
    const state = { ...createPetState('onchain', ADDRESS, false, now), energy: 50 };
    const ticked = applyTick(state, now + 2 * HOUR);
    expect(ticked.energy).toBeLessThan(state.energy);
  });

  it('transitions to hibernating once physicalHealth hits zero', () => {
    const now = Date.now();
    const state = { ...createPetState('onchain', ADDRESS, false, now), hunger: 100, physicalHealth: 1 };
    const ticked = applyTick(state, now + 1 * HOUR);
    expect(ticked.physicalHealth).toBe(0);
    expect(ticked.status).toBe('hibernating');
    expect(ticked.hibernatingSince).toBe(now + 1 * HOUR);
  });

  it('transitions to hibernating once mentalHealth hits zero', () => {
    const now = Date.now();
    const state = { ...createPetState('onchain', ADDRESS, false, now), happiness: 100, mentalHealth: 1 };
    const ticked = applyTick(state, now + 1 * HOUR);
    expect(ticked.mentalHealth).toBe(0);
    expect(ticked.status).toBe('hibernating');
  });

  it('marks the pet as gone after the hibernation timeout with no feeding', () => {
    const now = Date.now();
    const hibernatingSince = now - 8 * 24 * HOUR;
    const state = {
      ...createPetState('onchain', ADDRESS, false, now),
      status: 'hibernating' as const,
      hibernatingSince,
      lastTickAt: hibernatingSince,
    };
    const ticked = applyTick(state, now);
    expect(ticked.status).toBe('gone');
  });

  it('never ticks a pet that is already gone', () => {
    const now = Date.now();
    const state = { ...createPetState('onchain', ADDRESS, false, now), status: 'gone' as const, hunger: 0 };
    const ticked = applyTick(state, now + 5 * HOUR);
    expect(ticked.hunger).toBe(0);
    expect(ticked.status).toBe('gone');
  });
});

describe('applyFeed', () => {
  it('increases hunger, happiness, energy, physicalHealth, mentalHealth and lifetime total', () => {
    const now = Date.now();
    const state = {
      ...createPetState('onchain', ADDRESS, false, now),
      hunger: 40,
      happiness: 40,
      energy: 40,
      physicalHealth: 40,
      mentalHealth: 40,
    };
    const fed = applyFeed(state, 'tx1', 10_000, now);
    expect(fed.hunger).toBeGreaterThan(state.hunger);
    expect(fed.happiness).toBeGreaterThan(state.happiness);
    expect(fed.energy).toBeGreaterThan(state.energy);
    expect(fed.physicalHealth).toBeGreaterThan(state.physicalHealth);
    expect(fed.mentalHealth).toBeGreaterThan(state.mentalHealth);
    expect(fed.totalSatsFed).toBe(10_000);
    expect(fed.feedLog[0]).toMatchObject({ txid: 'tx1', sats: 10_000 });
  });

  it('is idempotent for a txid already seen', () => {
    const now = Date.now();
    const state = createPetState('onchain', ADDRESS, false, now);
    const first = applyFeed(state, 'tx1', 5_000, now);
    const second = applyFeed(first, 'tx1', 5_000, now);
    expect(second).toEqual(first);
  });

  it('revives a hibernating pet', () => {
    const now = Date.now();
    const state = {
      ...createPetState('onchain', ADDRESS, false, now),
      status: 'hibernating' as const,
      hibernatingSince: now,
      physicalHealth: 0,
      mentalHealth: 0,
    };
    const fed = applyFeed(state, 'tx-revive', 20_000, now);
    expect(fed.status).toBe('alive');
    expect(fed.hibernatingSince).toBeNull();
    expect(fed.physicalHealth).toBeGreaterThan(0);
    expect(fed.mentalHealth).toBeGreaterThan(0);
  });

  it('never feeds a pet that is gone', () => {
    const now = Date.now();
    const state = { ...createPetState('onchain', ADDRESS, false, now), status: 'gone' as const };
    const fed = applyFeed(state, 'tx1', 10_000, now);
    expect(fed).toEqual(state);
  });
});

describe('moodFor', () => {
  it('reflects status overrides regardless of stats', () => {
    const now = Date.now();
    const base = createPetState('onchain', ADDRESS, false, now);
    expect(moodFor({ ...base, status: 'hibernating', hunger: 100, happiness: 100, energy: 100 })).toBe('hibernating');
    expect(moodFor({ ...base, status: 'gone' })).toBe('gone');
  });

  it('derives mood from the average of hunger/happiness/energy/mentalHealth when alive', () => {
    const now = Date.now();
    const base = createPetState('onchain', ADDRESS, false, now);
    expect(moodFor({ ...base, hunger: 90, happiness: 90, energy: 90, mentalHealth: 90 })).toBe('happy');
    expect(moodFor({ ...base, hunger: 50, happiness: 50, energy: 50, mentalHealth: 50 })).toBe('neutral');
    expect(moodFor({ ...base, hunger: 20, happiness: 20, energy: 20, mentalHealth: 20 })).toBe('sad');
    expect(moodFor({ ...base, hunger: 5, happiness: 5, energy: 5, mentalHealth: 5 })).toBe('critical');
  });
});

describe('isNightInBrazil', () => {
  it('identifies nighttime hours (23:00–06:59 Brasília) as night', () => {
    expect(isNightInBrazil(new Date('2024-06-01T05:00:00Z').getTime())).toBe(true); // 02:00 BRT
    expect(isNightInBrazil(new Date('2024-06-02T02:00:00Z').getTime())).toBe(true); // 23:00 BRT (prev day)
  });

  it('identifies daytime hours as not night', () => {
    expect(isNightInBrazil(new Date('2024-06-01T17:00:00Z').getTime())).toBe(false); // 14:00 BRT
    expect(isNightInBrazil(new Date('2024-06-01T12:00:00Z').getTime())).toBe(false); // 09:00 BRT
  });
});

describe('practiceHabit', () => {
  it('boosts stats and increments the habit counter', () => {
    const now = Date.now();
    const state = createPetState('onchain', ADDRESS, false, now);
    const after = practiceHabit(state, 'gym', now);
    expect(after.habits.gym).toBe(1);
    expect(after.habits.carnivore).toBe(0);
    expect(after.lastHabitAt.gym).toBe(now);
    expect(after.happiness).toBeGreaterThan(state.happiness);
  });

  it('gym mainly builds physicalHealth, not intelligence', () => {
    const now = Date.now();
    const state = { ...createPetState('onchain', ADDRESS, false, now), physicalHealth: 50, intelligence: 40 };
    const after = practiceHabit(state, 'gym', now);
    expect(after.physicalHealth).toBeGreaterThan(state.physicalHealth);
    expect(after.intelligence).toBe(state.intelligence);
    expect(after.energy).toBeLessThan(state.energy);
  });

  it('austrianSchool mainly builds intelligence, not physicalHealth', () => {
    const now = Date.now();
    const state = { ...createPetState('onchain', ADDRESS, false, now), physicalHealth: 50, intelligence: 40 };
    const after = practiceHabit(state, 'austrianSchool', now);
    expect(after.intelligence).toBeGreaterThan(state.intelligence);
    expect(after.physicalHealth).toBe(state.physicalHealth);
  });

  it('carnivore mainly builds hunger and physicalHealth, not intelligence', () => {
    const now = Date.now();
    const state = { ...createPetState('onchain', ADDRESS, false, now), hunger: 50, physicalHealth: 50, intelligence: 40 };
    const after = practiceHabit(state, 'carnivore', now);
    expect(after.hunger).toBeGreaterThan(state.hunger);
    expect(after.physicalHealth).toBeGreaterThan(state.physicalHealth);
    expect(after.intelligence).toBe(state.intelligence);
  });

  it('each habit produces a different physicalHealth/intelligence signature', () => {
    const now = Date.now();
    const base = { ...createPetState('onchain', ADDRESS, false, now), physicalHealth: 50, intelligence: 40 };
    const afterGym = practiceHabit(base, 'gym', now);
    const afterSchool = practiceHabit(base, 'austrianSchool', now);
    const afterCarnivore = practiceHabit(base, 'carnivore', now);
    expect(afterGym.physicalHealth).not.toBe(afterSchool.physicalHealth);
    expect(afterGym.intelligence).not.toBe(afterSchool.intelligence);
    expect(afterCarnivore.physicalHealth).not.toBe(afterSchool.physicalHealth);
  });

  it('is a no-op within the cooldown window', () => {
    const now = Date.now();
    const state = practiceHabit(createPetState('onchain', ADDRESS, false, now), 'carnivore', now);
    const tooSoon = practiceHabit(state, 'carnivore', now + HABIT_COOLDOWN_MS - 1);
    expect(tooSoon).toEqual(state);
  });

  it('works again once the cooldown has elapsed', () => {
    const now = Date.now();
    const state = practiceHabit(createPetState('onchain', ADDRESS, false, now), 'carnivore', now);
    const later = practiceHabit(state, 'carnivore', now + HABIT_COOLDOWN_MS + 1);
    expect(later.habits.carnivore).toBe(2);
  });

  it('never affects a dead avatar', () => {
    const now = Date.now();
    const state = { ...createPetState('onchain', ADDRESS, false, now), status: 'gone' as const };
    expect(practiceHabit(state, 'gym', now)).toEqual(state);
  });

  it('tracks each habit kind independently', () => {
    const now = Date.now();
    let state = createPetState('onchain', ADDRESS, false, now);
    state = practiceHabit(state, 'gym', now);
    state = practiceHabit(state, 'austrianSchool', now);
    expect(state.habits).toEqual({ gym: 1, austrianSchool: 1, carnivore: 0 });
  });
});

describe('hasHabitBadge', () => {
  it('is false below the threshold and true once reached', () => {
    const now = Date.now();
    let state = createPetState('onchain', ADDRESS, false, now);
    for (let i = 0; i < HABIT_BADGE_THRESHOLD - 1; i++) {
      state = practiceHabit(state, 'gym', now + i * HABIT_COOLDOWN_MS);
    }
    expect(hasHabitBadge(state, 'gym')).toBe(false);
    state = practiceHabit(state, 'gym', now + HABIT_BADGE_THRESHOLD * HABIT_COOLDOWN_MS);
    expect(hasHabitBadge(state, 'gym')).toBe(true);
  });
});

describe('feedEffectDeltas', () => {
  it('gives a bigger boost the larger the payment', () => {
    const small = feedEffectDeltas(1_000, false);
    const large = feedEffectDeltas(100_000, false);
    expect(large.physicalHealth).toBeGreaterThan(small.physicalHealth);
    expect(large.mentalHealth).toBeGreaterThan(small.mentalHealth);
  });

  it('gives a flat revival boost to health when the pet was hibernating', () => {
    const deltas = feedEffectDeltas(1_000, true);
    expect(deltas.physicalHealth).toBe(25);
    expect(deltas.mentalHealth).toBe(25);
  });
});

describe('describeEffects', () => {
  it('formats each nonzero delta with its sign, icon and label', () => {
    const text = describeEffects(HABIT_STAT_EFFECTS.gym);
    expect(text).toContain('+14 💪 Saúde Física');
    expect(text).toContain('-10 ⚡ Energia');
  });

  it('omits stats with a zero or negligible delta', () => {
    const text = describeEffects({ hunger: 0.2, physicalHealth: 5 });
    expect(text).not.toContain('Fome');
    expect(text).toContain('+5 💪 Saúde Física');
  });
});
