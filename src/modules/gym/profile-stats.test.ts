import { describe, expect, it } from 'vitest';

import {
  aggregateProfileStats,
  rankExercisePRs,
  type ProfileSessionRow,
  type ProfileSetRow,
} from './profile-stats';

describe('aggregateProfileStats', () => {
  const now = new Date(2024, 5, 18, 12, 0, 0).getTime(); // Tue 18 Jun 2024

  const sets: ProfileSetRow[] = [
    // Completed, within the last 7 days.
    {
      weight: 100,
      reps: 5,
      completedAt: new Date(2024, 5, 17),
      muscleGroup: 'chest',
    },
    {
      weight: 50,
      reps: 10,
      completedAt: new Date(2024, 5, 16),
      muscleGroup: 'back',
    },
    {
      weight: 60,
      reps: 8,
      completedAt: new Date(2024, 5, 15),
      muscleGroup: 'chest',
    },
    // Completed, but older than 7 days → counts lifetime, not the muscle window.
    {
      weight: 80,
      reps: 5,
      completedAt: new Date(2024, 4, 29),
      muscleGroup: 'legs',
    },
    // Planned (never completed) → ignored everywhere.
    { weight: 200, reps: 5, completedAt: null, muscleGroup: 'chest' },
  ];

  const finished: ProfileSessionRow[] = [
    { finishedAt: new Date(2024, 5, 18) }, // this week
    { finishedAt: new Date(2024, 5, 11) }, // last week (consecutive)
    { finishedAt: new Date(2024, 4, 1) }, // isolated, weeks earlier
  ];

  const stats = aggregateProfileStats(sets, finished, now);

  it('counts completed sets only for lifetime totals', () => {
    expect(stats.totalSets).toBe(4);
    expect(stats.totalReps).toBe(28);
    // 100*5 + 50*10 + 60*8 + 80*5 = 1880
    expect(stats.totalVolume).toBe(1880);
  });

  it('counts finished sessions as workouts', () => {
    expect(stats.totalWorkouts).toBe(3);
  });

  it('ranks the last-7-days muscle breakdown, excluding older sets', () => {
    expect(stats.muscleBreakdown).toEqual([
      { muscleGroup: 'chest', sets: 2 },
      { muscleGroup: 'back', sets: 1 },
    ]);
  });

  it('computes current and longest streaks from finished weeks', () => {
    expect(stats.streakWeeks).toBe(2);
    expect(stats.longestStreakWeeks).toBe(2);
  });

  it('lists a calendar day per distinct finished session', () => {
    expect(stats.workoutDays).toHaveLength(3);
  });
});

describe('rankExercisePRs', () => {
  const rows = [
    { exerciseId: 1, exerciseName: 'Bench', reps: 5, weight: 100 },
    { exerciseId: 1, exerciseName: 'Bench', reps: 3, weight: 110 },
    { exerciseId: 2, exerciseName: 'Squat', reps: 5, weight: 140 },
    { exerciseId: 2, exerciseName: 'Squat', reps: 1, weight: 150 },
    { exerciseId: 3, exerciseName: 'Curl', reps: 10, weight: 30 },
  ];

  it('ranks exercises by best estimated 1RM, with per-exercise heaviest', () => {
    const ranked = rankExercisePRs(rows);
    expect(ranked.map((r) => r.exerciseName)).toEqual([
      'Squat',
      'Bench',
      'Curl',
    ]);
    // Squat best e1RM = 140 * (1 + 5/30) ≈ 163.3
    expect(ranked[0]!.best1RmKg).toBeCloseTo(163.33, 1);
    expect(ranked[0]!.heaviestKg).toBe(150);
  });

  it('caps the result at the given limit', () => {
    expect(rankExercisePRs(rows, 2).map((r) => r.exerciseName)).toEqual([
      'Squat',
      'Bench',
    ]);
  });

  it('returns an empty list when there are no sets', () => {
    expect(rankExercisePRs([])).toEqual([]);
  });
});
