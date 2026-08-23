import { describe, expect, it } from 'vitest';
import {
  applyFeed,
  applyTick,
  cancelPendingHabit,
  createPetState,
  describeEffects,
  feedEffectDeltas,
  feedPointsForSats,
  HABIT_BADGE_THRESHOLD,
  HABIT_INFO,
  HABIT_STAT_EFFECTS,
  hasHabitBadge,
  isNightInBrazil,
  moodFor,
  requestHabit,
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

describe('requestHabit', () => {
  it('sets a pendingHabit with the habit\'s cost, with no stat effect yet', () => {
    const now = Date.now();
    const state = createPetState('onchain', ADDRESS, false, now);
    const after = requestHabit(state, 'gym', now);
    expect(after.pendingHabit).toEqual({ kind: 'gym', costSats: HABIT_INFO.gym.costSats, requestedAt: now });
    expect(after.physicalHealth).toBe(state.physicalHealth);
    expect(after.habits.gym).toBe(0);
  });

  it('replaces whatever habit was previously pending', () => {
    const now = Date.now();
    const state = requestHabit(createPetState('onchain', ADDRESS, false, now), 'gym', now);
    const after = requestHabit(state, 'carnivore', now + 1);
    expect(after.pendingHabit?.kind).toBe('carnivore');
  });

  it('never affects a dead avatar', () => {
    const now = Date.now();
    const state = { ...createPetState('onchain', ADDRESS, false, now), status: 'gone' as const };
    expect(requestHabit(state, 'gym', now)).toEqual(state);
  });
});

describe('cancelPendingHabit', () => {
  it('clears a pending habit', () => {
    const now = Date.now();
    const state = requestHabit(createPetState('onchain', ADDRESS, false, now), 'gym', now);
    expect(cancelPendingHabit(state).pendingHabit).toBeNull();
  });

  it('is a no-op when nothing is pending', () => {
    const now = Date.now();
    const state = createPetState('onchain', ADDRESS, false, now);
    expect(cancelPendingHabit(state)).toEqual(state);
  });
});

describe('applyFeed — habit completion', () => {
  it('leaves the habit pending when the payment is smaller than its cost', () => {
    const now = Date.now();
    const state = requestHabit(createPetState('onchain', ADDRESS, false, now), 'gym', now);
    const fed = applyFeed(state, 'tx1', HABIT_INFO.gym.costSats - 1, now);
    expect(fed.pendingHabit).not.toBeNull();
    expect(fed.habits.gym).toBe(0);
    // The payment still counts as an ordinary feed.
    expect(fed.totalSatsFed).toBe(HABIT_INFO.gym.costSats - 1);
  });

  it('completes the habit once a payment meets or exceeds its cost, on top of the ordinary feed effects', () => {
    const now = Date.now();
    const state = { ...requestHabit(createPetState('onchain', ADDRESS, false, now), 'gym', now), physicalHealth: 50 };
    const fed = applyFeed(state, 'tx1', HABIT_INFO.gym.costSats, now);
    expect(fed.pendingHabit).toBeNull();
    expect(fed.habits.gym).toBe(1);
    expect(fed.lastHabitAt.gym).toBe(now);
    // Feed's own physicalHealth bump plus the habit's own +14 physicalHealth.
    expect(fed.physicalHealth).toBeGreaterThan(state.physicalHealth + 14);
    expect(fed.totalSatsFed).toBe(HABIT_INFO.gym.costSats);
  });

  it('produces a different signature per habit, beyond the ordinary feed effect every payment gives', () => {
    const now = Date.now();
    const base = { ...createPetState('onchain', ADDRESS, false, now), physicalHealth: 50, intelligence: 40 };

    const gymFed = applyFeed(requestHabit(base, 'gym', now), 'tx-gym', HABIT_INFO.gym.costSats, now);
    const gymBaselineFeed = applyFeed(base, 'tx-gym-baseline', HABIT_INFO.gym.costSats, now);
    expect(gymFed.physicalHealth).toBeGreaterThan(gymBaselineFeed.physicalHealth); // gym's own +14 on top
    expect(gymFed.intelligence).toBe(base.intelligence); // gym never touches intelligence

    const schoolFed = applyFeed(requestHabit(base, 'austrianSchool', now), 'tx-school', HABIT_INFO.austrianSchool.costSats, now);
    const schoolBaselineFeed = applyFeed(base, 'tx-school-baseline', HABIT_INFO.austrianSchool.costSats, now);
    expect(schoolFed.intelligence).toBeGreaterThan(base.intelligence);
    expect(schoolFed.physicalHealth).toBe(schoolBaselineFeed.physicalHealth); // no habit-specific physicalHealth bump
  });

  it('a payment with no pending habit never completes one', () => {
    const now = Date.now();
    const state = createPetState('onchain', ADDRESS, false, now);
    const fed = applyFeed(state, 'tx1', 100_000, now);
    expect(fed.habits).toEqual({ carnivore: 0, austrianSchool: 0, gym: 0 });
  });
});

describe('hasHabitBadge', () => {
  it('is false below the threshold and true once reached', () => {
    const now = Date.now();
    let state = createPetState('onchain', ADDRESS, false, now);
    for (let i = 0; i < HABIT_BADGE_THRESHOLD - 1; i++) {
      state = requestHabit(state, 'gym', now + i);
      state = applyFeed(state, `tx${i}`, HABIT_INFO.gym.costSats, now + i);
    }
    expect(hasHabitBadge(state, 'gym')).toBe(false);
    state = requestHabit(state, 'gym', now + HABIT_BADGE_THRESHOLD);
    state = applyFeed(state, `tx-final`, HABIT_INFO.gym.costSats, now + HABIT_BADGE_THRESHOLD);
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
