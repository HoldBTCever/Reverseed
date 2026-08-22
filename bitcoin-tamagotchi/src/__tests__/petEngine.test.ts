import { describe, expect, it } from 'vitest';
import {
  applyFeed,
  applyTick,
  createPetState,
  feedPointsForSats,
  moodFor,
  stageForTotalSats,
} from '../lib/petEngine';

const ADDRESS = 'bc1qtestaddress0000000000000000000000000';
const HOUR = 60 * 60 * 1000;

describe('stageForTotalSats', () => {
  it('starts as an unhatched egg', () => {
    expect(stageForTotalSats(0).name).toBe('Ovo de Satoshi');
  });

  it('hatches after any sats are fed', () => {
    expect(stageForTotalSats(1).name).toBe('Sat-Bebê');
  });

  it('evolves through thresholds', () => {
    expect(stageForTotalSats(10_000).name).toBe('Sat-Cub');
    expect(stageForTotalSats(100_000).name).toBe('HODLer Jr.');
    expect(stageForTotalSats(1_000_000).name).toBe('Bitcoin Whale');
    expect(stageForTotalSats(100_000_000).name).toBe('Satoshi Lendário');
  });

  it('never regresses below the highest threshold reached', () => {
    expect(stageForTotalSats(99_999).name).toBe('Sat-Cub');
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

  it('regenerates energy while sleeping instead of draining it', () => {
    const now = Date.now();
    const state = { ...createPetState('onchain', ADDRESS, false, now), isSleeping: true, energy: 50 };
    const ticked = applyTick(state, now + 2 * HOUR);
    expect(ticked.energy).toBeGreaterThan(state.energy);
  });

  it('transitions to hibernating once health chases down to zero', () => {
    const now = Date.now();
    let state = createPetState('onchain', ADDRESS, false, now);
    // Stats already bottomed out; give health-chase enough elapsed time
    // (rate is 0.35/hour) to fully catch up to its zero target in one tick.
    state = { ...state, hunger: 0, happiness: 0, energy: 0, health: 1 };
    const ticked = applyTick(state, now + 5 * HOUR);
    expect(ticked.health).toBe(0);
    expect(ticked.status).toBe('hibernating');
    expect(ticked.hibernatingSince).toBe(now + 5 * HOUR);
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
  it('increases hunger, happiness, energy and lifetime total', () => {
    const now = Date.now();
    const state = { ...createPetState('onchain', ADDRESS, false, now), hunger: 40, happiness: 40, energy: 40 };
    const fed = applyFeed(state, 'tx1', 10_000, now);
    expect(fed.hunger).toBeGreaterThan(state.hunger);
    expect(fed.happiness).toBeGreaterThan(state.happiness);
    expect(fed.energy).toBeGreaterThan(state.energy);
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
      health: 0,
    };
    const fed = applyFeed(state, 'tx-revive', 20_000, now);
    expect(fed.status).toBe('alive');
    expect(fed.hibernatingSince).toBeNull();
    expect(fed.health).toBeGreaterThan(0);
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

  it('derives mood from the average of hunger/happiness/energy when alive', () => {
    const now = Date.now();
    const base = createPetState('onchain', ADDRESS, false, now);
    expect(moodFor({ ...base, hunger: 90, happiness: 90, energy: 90 })).toBe('happy');
    expect(moodFor({ ...base, hunger: 50, happiness: 50, energy: 50 })).toBe('neutral');
    expect(moodFor({ ...base, hunger: 20, happiness: 20, energy: 20 })).toBe('sad');
    expect(moodFor({ ...base, hunger: 5, happiness: 5, energy: 5 })).toBe('critical');
  });
});
