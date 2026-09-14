import { describe, it, expect } from 'vitest';
import { computeMasteryUpdate, computeTrend, selectDifficulty } from '../adaptive';

describe('selectDifficulty', () => {
  it('maps low mastery to low difficulty and high mastery to high difficulty', () => {
    expect(selectDifficulty(10)).toBe(1);
    expect(selectDifficulty(95)).toBe(5);
  });
});

describe('computeMasteryUpdate', () => {
  it('increases mastery on a correct hard question more than a correct easy one', () => {
    const easyGain = computeMasteryUpdate({ currentMastery: 50, difficulty: 1, scored: 100 }) - 50;
    const hardGain = computeMasteryUpdate({ currentMastery: 50, difficulty: 5, scored: 100 }) - 50;
    expect(hardGain).toBeGreaterThan(easyGain);
  });

  it('never exceeds 100 or drops below 0', () => {
    expect(computeMasteryUpdate({ currentMastery: 98, difficulty: 5, scored: 100 })).toBeLessThanOrEqual(100);
    expect(computeMasteryUpdate({ currentMastery: 2, difficulty: 5, scored: 0 })).toBeGreaterThanOrEqual(0);
  });

  it('decreases mastery on an incorrect answer', () => {
    const result = computeMasteryUpdate({ currentMastery: 50, difficulty: 3, scored: 0 });
    expect(result).toBeLessThan(50);
  });
});

describe('computeTrend', () => {
  it('classifies a meaningful increase as IMPROVING', () => {
    expect(computeTrend(50, 60)).toBe('IMPROVING');
  });
  it('classifies a meaningful decrease as NEEDS_ATTENTION', () => {
    expect(computeTrend(60, 50)).toBe('NEEDS_ATTENTION');
  });
  it('classifies a small change as STABLE', () => {
    expect(computeTrend(50, 52)).toBe('STABLE');
  });
});
