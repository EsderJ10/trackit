import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { db } from '@/core/db/client';

import {
  advanceCursor,
  advanceSlot,
  generateWave,
  type ProgressionScheme,
  renderPrescribedSet,
  suggestNext,
  type WaveRules,
} from '../progression-engine';
import {
  exercises,
  exerciseTrainingState,
  gymSettings,
  programDays,
  programExercises,
  programs,
  programSets,
  programWeeks,
  setLogs,
  workoutSessions,
} from '../schema';

import { addSet } from './sessions';

// Programs + progression (M5). A program owns days (split) and weeks
// (periodization); a cursor (currentWeek + currentDayIndex) walks the week × day
// grid, advancing per finished session. State is keyed per program-exercise slot
// (a lift may appear on >1 day). Decision logic lives in `progression-engine`.

export function useActivePrograms() {
  return useLiveQuery(
    db
      .select()
      .from(programs)
      .where(eq(programs.active, true))
      .orderBy(desc(programs.createdAt)),
  );
}

export function useProgram(programId: number) {
  const { data } = useLiveQuery(
    db.select().from(programs).where(eq(programs.id, programId)),
    [programId],
  );
  return data[0];
}

export interface CurrentProgram {
  id: number;
  name: string;
  currentWeek: number;
  currentDayIndex: number;
  currentCycle: number;
  lengthWeeks: number;
}

/** The single program being followed (`gym_settings` pointer); distinct from `useActivePrograms` (the whole library). */
export function useCurrentProgram(): CurrentProgram | undefined {
  const { data } = useLiveQuery(
    db
      .select({
        id: programs.id,
        name: programs.name,
        currentWeek: programs.currentWeek,
        currentDayIndex: programs.currentDayIndex,
        currentCycle: programs.currentCycle,
        lengthWeeks: programs.lengthWeeks,
      })
      .from(gymSettings)
      .innerJoin(programs, eq(programs.id, gymSettings.currentProgramId))
      .where(eq(gymSettings.id, 1))
      .limit(1),
  );
  return data[0];
}

/** Pick (or clear) the program to follow; upserts the singleton settings row. */
export function setCurrentProgram(programId: number | null): void {
  db.insert(gymSettings)
    .values({ id: 1, currentProgramId: programId })
    .onConflictDoUpdate({
      target: gymSettings.id,
      set: { currentProgramId: programId },
    })
    .run();
}

export interface NextProgramWorkout {
  programId: number;
  programName: string;
  /** 1-based week the cursor sits in. */
  weekIndex: number;
  lengthWeeks: number;
  /** 0-based day the cursor sits in. */
  dayIndex: number;
  dayCount: number;
  /** Null when the program has no day at the cursor (needs setup). */
  dayName: string | null;
  isDeload: boolean;
  /** Exercise names for the upcoming day, in order — a preview for the hero. */
  exerciseNames: string[];
  /** True when the cursor's day exists and has at least one exercise. */
  ready: boolean;
}

/**
 * Resolves the current program's cursor into the next workout (day, exercises,
 * deload) for the Train hero — a read-only mirror of `startProgramWorkout`'s
 * cursor → day → exercises walk. `undefined` when no program is followed.
 */
export function useNextProgramWorkout(): NextProgramWorkout | undefined {
  const current = useCurrentProgram();
  const programId = current?.id ?? -1;
  const weekIndex = current?.currentWeek ?? 1;
  const dayIndex = current?.currentDayIndex ?? 0;

  const { data: days } = useLiveQuery(
    db
      .select({
        id: programDays.id,
        dayIndex: programDays.dayIndex,
        name: programDays.name,
      })
      .from(programDays)
      .where(eq(programDays.programId, programId))
      .orderBy(programDays.dayIndex),
    [programId],
  );

  const currentDay = days.find((d) => d.dayIndex === dayIndex);
  const dayId = currentDay?.id ?? -1;

  const { data: exRows } = useLiveQuery(
    db
      .select({ name: exercises.name })
      .from(programExercises)
      .innerJoin(exercises, eq(programExercises.exerciseId, exercises.id))
      .where(eq(programExercises.programDayId, dayId))
      .orderBy(programExercises.position),
    [dayId],
  );

  const { data: weekRows } = useLiveQuery(
    db
      .select({ isDeload: programWeeks.isDeload })
      .from(programWeeks)
      .where(
        and(
          eq(programWeeks.programId, programId),
          eq(programWeeks.weekIndex, weekIndex),
        ),
      )
      .limit(1),
    [programId, weekIndex],
  );

  return useMemo(() => {
    if (!current) return undefined;
    const exerciseNames = exRows.map((r) => r.name);
    return {
      programId: current.id,
      programName: current.name,
      weekIndex: current.currentWeek,
      lengthWeeks: current.lengthWeeks,
      dayIndex: current.currentDayIndex,
      dayCount: days.length,
      dayName: currentDay?.name ?? null,
      isDeload: weekRows[0]?.isDeload ?? false,
      exerciseNames,
      ready: currentDay != null && exerciseNames.length > 0,
    };
  }, [current, days, currentDay, exRows, weekRows]);
}

export interface ProgramRoadmap {
  /** 1-based week the cursor sits in. */
  currentWeek: number;
  /** 0-based day the cursor sits in. */
  currentDayIndex: number;
  /** Which pass through the program the cursor is on. */
  currentCycle: number;
  /**
   * Finished sessions of THIS cycle, keyed `${weekIndex}:${dayIndex}` → sessionId.
   * Drives history-aware cell status (a passed cell with no entry is a skip).
   */
  logged: Map<string, number>;
}

/**
 * Cursor + this-cycle session history for the roadmap. "Done" reflects an actual
 * logged session (not just a cursor that walked past), so skipped days surface as
 * recoverable gaps. Legacy rows (null `programCycle`) are treated as cycle 1.
 */
export function useProgramRoadmap(programId: number): ProgramRoadmap {
  const program = useProgram(programId);
  const currentCycle = program?.currentCycle ?? 1;

  const { data: rows } = useLiveQuery(
    db
      .select({
        id: workoutSessions.id,
        weekIndex: workoutSessions.programWeekIndex,
        dayIndex: workoutSessions.programDayIndex,
        cycle: workoutSessions.programCycle,
      })
      .from(workoutSessions)
      .where(
        and(
          eq(workoutSessions.programId, programId),
          isNotNull(workoutSessions.finishedAt),
        ),
      )
      .orderBy(workoutSessions.finishedAt),
    [programId],
  );

  return useMemo(() => {
    const logged = new Map<string, number>();
    for (const r of rows) {
      if (r.weekIndex == null || r.dayIndex == null) continue;
      if ((r.cycle ?? 1) !== currentCycle) continue;
      // Ordered by finishedAt asc, so the latest session for a cell wins.
      logged.set(`${r.weekIndex}:${r.dayIndex}`, r.id);
    }
    return {
      currentWeek: program?.currentWeek ?? 1,
      currentDayIndex: program?.currentDayIndex ?? 0,
      currentCycle,
      logged,
    };
  }, [rows, program, currentCycle]);
}

/** Every program's days (id, index, name) — for rendering each program's cursor. */
export function useAllProgramDays() {
  return useLiveQuery(
    db
      .select({
        programId: programDays.programId,
        dayIndex: programDays.dayIndex,
        name: programDays.name,
      })
      .from(programDays)
      .orderBy(programDays.programId, programDays.dayIndex),
  );
}

export interface ProgramDayRow {
  id: number;
  dayIndex: number;
  name: string;
}

export function useProgramDays(programId: number) {
  return useLiveQuery(
    db
      .select({
        id: programDays.id,
        dayIndex: programDays.dayIndex,
        name: programDays.name,
      })
      .from(programDays)
      .where(eq(programDays.programId, programId))
      .orderBy(programDays.dayIndex),
    [programId],
  );
}

/** Append a day at the next index; returns the new day id. */
export function addProgramDay(programId: number, name?: string): number {
  const siblings = db
    .select({ id: programDays.id })
    .from(programDays)
    .where(eq(programDays.programId, programId))
    .all();
  const dayIndex = siblings.length;
  const result = db
    .insert(programDays)
    .values({ programId, dayIndex, name: name ?? `Day ${dayIndex + 1}` })
    .run();
  return result.lastInsertRowId;
}

export function renameProgramDay(dayId: number, name: string): void {
  db.update(programDays)
    .set({ name: name.trim() || 'Day' })
    .where(eq(programDays.id, dayId))
    .run();
}

/** Remove a day (its exercises + their state/sets cascade) and reindex the rest. */
export function removeProgramDay(programId: number, dayId: number): void {
  db.transaction((tx) => {
    tx.delete(programDays).where(eq(programDays.id, dayId)).run();
    const remaining = tx
      .select({ id: programDays.id })
      .from(programDays)
      .where(eq(programDays.programId, programId))
      .orderBy(programDays.dayIndex)
      .all();
    remaining.forEach((row, index) => {
      tx.update(programDays)
        .set({ dayIndex: index })
        .where(eq(programDays.id, row.id))
        .run();
    });
  });
}

/**
 * Deep-copy a day (its exercises, each one's 1:1 training state, and any
 * prescriptions) to the end of the program. Returns the new day id.
 */
export function duplicateProgramDay(programId: number, dayId: number): number {
  return db.transaction((tx) => {
    const source = tx
      .select()
      .from(programDays)
      .where(eq(programDays.id, dayId))
      .all()[0];
    if (source == null) throw new Error(`Program day ${dayId} not found`);

    const dayIndex = tx
      .select({ id: programDays.id })
      .from(programDays)
      .where(eq(programDays.programId, programId))
      .all().length;
    const newDayId = tx
      .insert(programDays)
      .values({ programId, dayIndex, name: `${source.name} (copy)` })
      .run().lastInsertRowId;

    const slots = tx
      .select()
      .from(programExercises)
      .where(eq(programExercises.programDayId, dayId))
      .orderBy(programExercises.position)
      .all();

    // Old slot id → new slot id, so superset groups (keyed by the anchor row's
    // id) re-point within the copied day instead of back at the original.
    const idMap = new Map<number, number>();
    for (const slot of slots) {
      const newSlotId = tx
        .insert(programExercises)
        .values({
          programId,
          programDayId: newDayId,
          exerciseId: slot.exerciseId,
          position: slot.position,
          schemeType: slot.schemeType,
          targetSets: slot.targetSets,
          incrementKg: slot.incrementKg,
          minReps: slot.minReps,
          maxReps: slot.maxReps,
          failThreshold: slot.failThreshold,
          deloadPct: slot.deloadPct,
          tmIncrementKg: slot.tmIncrementKg,
          targetRpe: slot.targetRpe,
          // Remapped in a second pass, once every new id is known.
          supersetGroup: null,
        })
        .run().lastInsertRowId;
      idMap.set(slot.id, newSlotId);

      const state = tx
        .select()
        .from(exerciseTrainingState)
        .where(eq(exerciseTrainingState.programExerciseId, slot.id))
        .all()[0];
      if (state != null) {
        tx.insert(exerciseTrainingState)
          .values({
            programExerciseId: newSlotId,
            currentWeightKg: state.currentWeightKg,
            currentReps: state.currentReps,
            successStreak: state.successStreak,
            failStreak: state.failStreak,
            trainingMaxKg: state.trainingMaxKg,
            e1rmKg: state.e1rmKg,
            lastReason: state.lastReason,
          })
          .run();
      }

      for (const s of tx
        .select()
        .from(programSets)
        .where(eq(programSets.programExerciseId, slot.id))
        .all()) {
        tx.insert(programSets)
          .values({
            programExerciseId: newSlotId,
            weekIndex: s.weekIndex,
            setNumber: s.setNumber,
            reps: s.reps,
            intensityKind: s.intensityKind,
            intensityValue: s.intensityValue,
            amrap: s.amrap,
            restSec: s.restSec,
          })
          .run();
      }
    }

    for (const slot of slots) {
      if (slot.supersetGroup == null) continue;
      const newSlotId = idMap.get(slot.id);
      if (newSlotId == null) continue;
      tx.update(programExercises)
        .set({ supersetGroup: idMap.get(slot.supersetGroup) ?? null })
        .where(eq(programExercises.id, newSlotId))
        .run();
    }

    return newDayId;
  });
}

export interface ProgramWeekRow {
  id: number;
  weekIndex: number;
  name: string | null;
  isDeload: boolean;
}

export function useProgramWeeks(programId: number) {
  return useLiveQuery(
    db
      .select({
        id: programWeeks.id,
        weekIndex: programWeeks.weekIndex,
        name: programWeeks.name,
        isDeload: programWeeks.isDeload,
      })
      .from(programWeeks)
      .where(eq(programWeeks.programId, programId))
      .orderBy(programWeeks.weekIndex),
    [programId],
  );
}

/** Append a week at the next index and keep `programs.lengthWeeks` in sync. */
export function addProgramWeek(programId: number, name?: string): number {
  return db.transaction((tx) => {
    const siblings = tx
      .select({ id: programWeeks.id })
      .from(programWeeks)
      .where(eq(programWeeks.programId, programId))
      .all();
    const weekIndex = siblings.length + 1;
    const result = tx
      .insert(programWeeks)
      .values({ programId, weekIndex, name: name ?? `Week ${weekIndex}` })
      .run();
    tx.update(programs)
      .set({ lengthWeeks: weekIndex })
      .where(eq(programs.id, programId))
      .run();
    return result.lastInsertRowId;
  });
}

export function setProgramWeekDeload(weekId: number, isDeload: boolean): void {
  db.update(programWeeks)
    .set({ isDeload })
    .where(eq(programWeeks.id, weekId))
    .run();
}

export function renameProgramWeek(weekId: number, name: string): void {
  db.update(programWeeks)
    .set({ name: name.trim() || null })
    .where(eq(programWeeks.id, weekId))
    .run();
}

/**
 * Remove a week, then shift higher weeks (and their `program_sets`, joined by
 * integer `weekIndex` — no FK cascade) down in lockstep to keep indices
 * contiguous, and resync `programs.lengthWeeks`.
 */
export function removeProgramWeek(programId: number, weekId: number): void {
  db.transaction((tx) => {
    const target = tx
      .select({ weekIndex: programWeeks.weekIndex })
      .from(programWeeks)
      .where(eq(programWeeks.id, weekId))
      .all()[0];
    if (target == null) return;
    const removed = target.weekIndex;

    const slotIds = tx
      .select({ id: programExercises.id })
      .from(programExercises)
      .where(eq(programExercises.programId, programId))
      .all()
      .map((r) => r.id);

    tx.delete(programWeeks).where(eq(programWeeks.id, weekId)).run();
    if (slotIds.length > 0) {
      tx.delete(programSets)
        .where(
          and(
            inArray(programSets.programExerciseId, slotIds),
            eq(programSets.weekIndex, removed),
          ),
        )
        .run();
    }

    // Reindex remaining weeks to 1..n; move each week's prescriptions in lockstep.
    const remaining = tx
      .select({ id: programWeeks.id, weekIndex: programWeeks.weekIndex })
      .from(programWeeks)
      .where(eq(programWeeks.programId, programId))
      .orderBy(programWeeks.weekIndex)
      .all();
    remaining.forEach((row, index) => {
      const newIndex = index + 1;
      if (row.weekIndex === newIndex) return;
      tx.update(programWeeks)
        .set({ weekIndex: newIndex })
        .where(eq(programWeeks.id, row.id))
        .run();
      if (slotIds.length > 0) {
        tx.update(programSets)
          .set({ weekIndex: newIndex })
          .where(
            and(
              inArray(programSets.programExerciseId, slotIds),
              eq(programSets.weekIndex, row.weekIndex),
            ),
          )
          .run();
      }
    });

    tx.update(programs)
      .set({ lengthWeeks: Math.max(1, remaining.length) })
      .where(eq(programs.id, programId))
      .run();
  });
}

/**
 * Append a copy of a week at the end: clones `isDeload` and replicates that
 * week's prescriptions (`program_sets`, keyed by integer `weekIndex`) for every
 * slot, so the user tweaks a copy instead of re-authoring. Returns the new week id.
 */
export function duplicateProgramWeek(
  programId: number,
  weekId: number,
): number {
  return db.transaction((tx) => {
    const source = tx
      .select()
      .from(programWeeks)
      .where(eq(programWeeks.id, weekId))
      .all()[0];
    if (source == null) throw new Error(`Program week ${weekId} not found`);

    const weekIndex =
      tx
        .select({ id: programWeeks.id })
        .from(programWeeks)
        .where(eq(programWeeks.programId, programId))
        .all().length + 1;
    const baseName = source.name ?? `Week ${source.weekIndex}`;
    const newWeekId = tx
      .insert(programWeeks)
      .values({
        programId,
        weekIndex,
        name: `${baseName} (copy)`,
        isDeload: source.isDeload,
      })
      .run().lastInsertRowId;

    const slotIds = tx
      .select({ id: programExercises.id })
      .from(programExercises)
      .where(eq(programExercises.programId, programId))
      .all()
      .map((r) => r.id);
    if (slotIds.length > 0) {
      for (const s of tx
        .select()
        .from(programSets)
        .where(
          and(
            inArray(programSets.programExerciseId, slotIds),
            eq(programSets.weekIndex, source.weekIndex),
          ),
        )
        .all()) {
        tx.insert(programSets)
          .values({
            programExerciseId: s.programExerciseId,
            weekIndex,
            setNumber: s.setNumber,
            reps: s.reps,
            intensityKind: s.intensityKind,
            intensityValue: s.intensityValue,
            amrap: s.amrap,
            restSec: s.restSec,
          })
          .run();
      }
    }

    tx.update(programs)
      .set({ lengthWeeks: weekIndex })
      .where(eq(programs.id, programId))
      .run();

    return newWeekId;
  });
}

/**
 * Author a full periodized wave for one slot from mesocycle rules: ensure enough
 * weeks (creating missing, flagging the deload), wipe the slot's prescriptions,
 * and write `generateWave`'s grid as `program_sets`.
 */
export function generateProgramWave(
  programExerciseId: number,
  rules: WaveRules,
): void {
  const cells = generateWave(rules);
  const totalWeeks = rules.weekCount + (rules.deload ? 1 : 0);
  const deloadIndex = rules.deload ? rules.weekCount + 1 : null;

  db.transaction((tx) => {
    const slot = tx
      .select({ programId: programExercises.programId })
      .from(programExercises)
      .where(eq(programExercises.id, programExerciseId))
      .all()[0];
    if (slot == null) return;
    const { programId } = slot;

    const existing = tx
      .select({ weekIndex: programWeeks.weekIndex })
      .from(programWeeks)
      .where(eq(programWeeks.programId, programId))
      .all();
    const haveMax = existing.reduce((m, w) => Math.max(m, w.weekIndex), 0);
    for (let w = haveMax + 1; w <= totalWeeks; w++) {
      tx.insert(programWeeks)
        .values({ programId, weekIndex: w, name: `Week ${w}` })
        .run();
    }
    if (deloadIndex != null) {
      tx.update(programWeeks)
        .set({ isDeload: true })
        .where(
          and(
            eq(programWeeks.programId, programId),
            eq(programWeeks.weekIndex, deloadIndex),
          ),
        )
        .run();
    }
    if (totalWeeks > haveMax) {
      tx.update(programs)
        .set({ lengthWeeks: totalWeeks })
        .where(eq(programs.id, programId))
        .run();
    }

    tx.delete(programSets)
      .where(eq(programSets.programExerciseId, programExerciseId))
      .run();
    for (const c of cells) {
      tx.insert(programSets)
        .values({
          programExerciseId,
          weekIndex: c.weekIndex,
          setNumber: c.setNumber,
          reps: c.reps,
          intensityKind: c.intensityKind,
          intensityValue: c.intensityValue,
          amrap: c.amrap,
          restSec: null,
        })
        .run();
    }
  });
}

/** Create a program seeded with one week and one day so it's usable at once. */
export function createProgram(name: string, description?: string): number {
  return db.transaction((tx) => {
    const result = tx.insert(programs).values({ name, description }).run();
    const programId = result.lastInsertRowId;
    tx.insert(programWeeks)
      .values({ programId, weekIndex: 1, name: 'Week 1' })
      .run();
    tx.insert(programDays)
      .values({ programId, dayIndex: 0, name: 'Day 1' })
      .run();
    return programId;
  });
}

export function renameProgram(programId: number, name: string): void {
  db.update(programs).set({ name }).where(eq(programs.id, programId)).run();
}

export function deleteProgram(programId: number): void {
  // `workout_sessions.program_id` was added via ALTER (migration 0005), so SQLite
  // dropped its ON DELETE — clear the refs ourselves so history survives.
  // Days/weeks/exercises (and their state/sets) cascade.
  db.transaction((tx) => {
    tx.update(workoutSessions)
      .set({ programId: null, programDayId: null })
      .where(eq(workoutSessions.programId, programId))
      .run();
    // Same ALTER-dropped-FK story for the currently-following pointer.
    tx.update(gymSettings)
      .set({ currentProgramId: null })
      .where(eq(gymSettings.currentProgramId, programId))
      .run();
    tx.delete(programs).where(eq(programs.id, programId)).run();
  });
}

export interface ProgramExerciseRow {
  id: number;
  programDayId: number;
  dayIndex: number;
  dayName: string;
  exerciseId: number;
  exerciseName: string;
  muscleGroup: string;
  position: number;
  schemeType: 'lp' | 'dp' | 'percent' | 'rpe';
  targetSets: number;
  incrementKg: number;
  minReps: number | null;
  maxReps: number | null;
  targetRpe: number | null;
  /** Current working weight (canonical kg) — convert at render. */
  currentWeightKg: number;
  currentReps: number;
  trainingMaxKg: number | null;
  e1rmKg: number | null;
  /** Why the suggestion is what it is; null before the first finished session. */
  lastReason: string | null;
  /** Superset group id (anchor row's id) within the day; null = standalone. */
  supersetGroup: number | null;
}

const programExerciseSelection = {
  id: programExercises.id,
  programDayId: programExercises.programDayId,
  dayIndex: programDays.dayIndex,
  dayName: programDays.name,
  exerciseId: exercises.id,
  exerciseName: exercises.name,
  muscleGroup: exercises.muscleGroup,
  position: programExercises.position,
  schemeType: programExercises.schemeType,
  targetSets: programExercises.targetSets,
  incrementKg: programExercises.incrementKg,
  minReps: programExercises.minReps,
  maxReps: programExercises.maxReps,
  targetRpe: programExercises.targetRpe,
  currentWeightKg: exerciseTrainingState.currentWeightKg,
  currentReps: exerciseTrainingState.currentReps,
  trainingMaxKg: exerciseTrainingState.trainingMaxKg,
  e1rmKg: exerciseTrainingState.e1rmKg,
  lastReason: exerciseTrainingState.lastReason,
  supersetGroup: programExercises.supersetGroup,
};

/** A program's exercises (all days) joined with their live state, for the editor. */
export function useProgramExercises(programId: number) {
  return useLiveQuery(
    db
      .select(programExerciseSelection)
      .from(programExercises)
      .innerJoin(programDays, eq(programExercises.programDayId, programDays.id))
      .innerJoin(exercises, eq(programExercises.exerciseId, exercises.id))
      .innerJoin(
        exerciseTrainingState,
        eq(exerciseTrainingState.programExerciseId, programExercises.id),
      )
      .where(eq(programExercises.programId, programId))
      .orderBy(programDays.dayIndex, programExercises.position),
    [programId],
  );
}

/** The exercises for one program day (the active workout's day), with state. */
export function useProgramDayExercises(programDayId: number) {
  return useLiveQuery(
    db
      .select(programExerciseSelection)
      .from(programExercises)
      .innerJoin(programDays, eq(programExercises.programDayId, programDays.id))
      .innerJoin(exercises, eq(programExercises.exerciseId, exercises.id))
      .innerJoin(
        exerciseTrainingState,
        eq(exerciseTrainingState.programExerciseId, programExercises.id),
      )
      .where(eq(programExercises.programDayId, programDayId))
      .orderBy(programExercises.position),
    [programDayId],
  );
}

/**
 * The progression rule chosen when adding a slot. lp/dp carry their own params
 * (see `ProgressionScheme`); `rpe` autoregulates against an estimated-1RM anchor.
 */
export type ProgramSchemeChoice =
  | ProgressionScheme
  | { type: 'rpe'; targetRpe: number };

export interface AddProgramExerciseInput {
  programId: number;
  programDayId: number;
  exerciseId: number;
  scheme: ProgramSchemeChoice;
  targetSets: number;
  /** Starting working weight (canonical kg). */
  startingWeightKg: number;
  /** Starting rep target — lp keeps its rep target only in state; dp uses minReps. */
  startingReps?: number;
}

/**
 * Add an exercise to a program day and seed its 1:1 training-state row. Duplicate
 * lifts are refused within the same day only. Returns the new program-exercise id.
 */
export function addProgramExercise(input: AddProgramExerciseInput): number {
  const { programId, programDayId, exerciseId, scheme, targetSets } = input;

  const daySlots = db
    .select({
      id: programExercises.id,
      exerciseId: programExercises.exerciseId,
    })
    .from(programExercises)
    .where(eq(programExercises.programDayId, programDayId))
    .all();
  const duplicate = daySlots.find((slot) => slot.exerciseId === exerciseId);
  if (duplicate) return duplicate.id;

  return db.transaction((tx) => {
    const inserted = tx
      .insert(programExercises)
      .values({
        programId,
        programDayId,
        exerciseId,
        position: daySlots.length,
        schemeType: scheme.type,
        targetSets,
        incrementKg: scheme.type === 'rpe' ? 2.5 : scheme.incrementKg,
        minReps: scheme.type === 'dp' ? scheme.minReps : null,
        maxReps: scheme.type === 'dp' ? scheme.maxReps : null,
        failThreshold: scheme.type === 'lp' ? scheme.failThreshold : 3,
        deloadPct: scheme.type === 'lp' ? scheme.deloadPct : 0.1,
        targetRpe: scheme.type === 'rpe' ? scheme.targetRpe : null,
      })
      .run();
    const programExerciseId = inserted.lastInsertRowId;

    tx.insert(exerciseTrainingState)
      .values({
        programExerciseId,
        currentWeightKg: input.startingWeightKg,
        currentReps:
          scheme.type === 'dp' ? scheme.minReps : (input.startingReps ?? 5),
        // rpe renders off the e1RM anchor — seed from starting weight so the
        // first session isn't zeroed.
        e1rmKg: scheme.type === 'rpe' ? input.startingWeightKg : null,
        lastReason: 'Starting weight',
      })
      .run();
    return programExerciseId;
  });
}

/** Set a slot's working weight (canonical kg). */
export function setProgramExerciseWeight(
  programExerciseId: number,
  weightKg: number,
): void {
  db.update(exerciseTrainingState)
    .set({ currentWeightKg: weightKg })
    .where(eq(exerciseTrainingState.programExerciseId, programExerciseId))
    .run();
}

/** Set a slot's training max (canonical kg) — percentage schemes. */
export function setProgramExerciseTrainingMax(
  programExerciseId: number,
  trainingMaxKg: number,
): void {
  db.update(exerciseTrainingState)
    .set({ trainingMaxKg })
    .where(eq(exerciseTrainingState.programExerciseId, programExerciseId))
    .run();
}

/** Set a slot's estimated 1RM anchor (canonical kg) — rpe scheme. */
export function setProgramExerciseE1rm(
  programExerciseId: number,
  e1rmKg: number,
): void {
  db.update(exerciseTrainingState)
    .set({ e1rmKg })
    .where(eq(exerciseTrainingState.programExerciseId, programExerciseId))
    .run();
}

/**
 * Switch an existing slot's progression rule (same field-mapping as
 * `addProgramExercise`). The old scheme's wave prescriptions no longer apply, so
 * they're wiped; training state is nudged so the new scheme renders sanely
 * (seed the rpe e1RM anchor, align dp's rep target).
 */
export function updateProgramExerciseScheme(
  programExerciseId: number,
  scheme: ProgramSchemeChoice,
  targetSets?: number,
): void {
  db.transaction((tx) => {
    tx.update(programExercises)
      .set({
        schemeType: scheme.type,
        incrementKg: scheme.type === 'rpe' ? 2.5 : scheme.incrementKg,
        minReps: scheme.type === 'dp' ? scheme.minReps : null,
        maxReps: scheme.type === 'dp' ? scheme.maxReps : null,
        failThreshold: scheme.type === 'lp' ? scheme.failThreshold : 3,
        deloadPct: scheme.type === 'lp' ? scheme.deloadPct : 0.1,
        targetRpe: scheme.type === 'rpe' ? scheme.targetRpe : null,
        ...(targetSets != null ? { targetSets } : {}),
      })
      .where(eq(programExercises.id, programExerciseId))
      .run();

    tx.delete(programSets)
      .where(eq(programSets.programExerciseId, programExerciseId))
      .run();

    const state = tx
      .select()
      .from(exerciseTrainingState)
      .where(eq(exerciseTrainingState.programExerciseId, programExerciseId))
      .all()[0];
    if (state == null) return;

    const patch: { lastReason: string; e1rmKg?: number; currentReps?: number } =
      { lastReason: 'Scheme changed' };
    if (scheme.type === 'rpe' && state.e1rmKg == null) {
      patch.e1rmKg = state.currentWeightKg;
    }
    if (scheme.type === 'dp') patch.currentReps = scheme.minReps;
    tx.update(exerciseTrainingState)
      .set(patch)
      .where(eq(exerciseTrainingState.programExerciseId, programExerciseId))
      .run();
  });
}

/** Remove a program-exercise slot (its state + prescriptions cascade). */
export function removeProgramExercise(programExerciseId: number): void {
  db.delete(programExercises)
    .where(eq(programExercises.id, programExerciseId))
    .run();
}

/** Rewrite each program_exercises row's day-local `position` to its index in `orderedIds` (single day), in one transaction. */
export function reorderProgramExercises(orderedIds: number[]): void {
  db.transaction((tx) => {
    orderedIds.forEach((id, index) => {
      tx.update(programExercises)
        .set({ position: index })
        .where(eq(programExercises.id, id))
        .run();
    });
  });
}

/** Rewrite each day's `dayIndex` to its position in `orderedDayIds`, in one transaction. */
export function reorderProgramDays(orderedDayIds: number[]): void {
  db.transaction((tx) => {
    orderedDayIds.forEach((id, index) => {
      tx.update(programDays)
        .set({ dayIndex: index })
        .where(eq(programDays.id, id))
        .run();
    });
  });
}

// Disjoint range to park `program_sets.weekIndex` mid-reorder, so an arbitrary
// permutation can't collide on a value another week is moving into.
const WEEK_REORDER_OFFSET = 100_000;

/**
 * Reassign `weekIndex` to 1..n by position in `orderedWeekIds`, moving each
 * week's `program_sets` (joined by integer `weekIndex`, no FK) in lockstep so
 * prescriptions stay attached to their week.
 */
export function reorderProgramWeeks(
  programId: number,
  orderedWeekIds: number[],
): void {
  db.transaction((tx) => {
    const currentById = new Map(
      tx
        .select({ id: programWeeks.id, weekIndex: programWeeks.weekIndex })
        .from(programWeeks)
        .where(eq(programWeeks.programId, programId))
        .all()
        .map((w) => [w.id, w.weekIndex]),
    );
    const slotIds = tx
      .select({ id: programExercises.id })
      .from(programExercises)
      .where(eq(programExercises.programId, programId))
      .all()
      .map((r) => r.id);

    // old weekIndex → new weekIndex (1-based by position).
    const remap = new Map<number, number>();
    orderedWeekIds.forEach((id, index) => {
      const old = currentById.get(id);
      if (old != null) remap.set(old, index + 1);
    });

    // Week rows reindex by id, so they never collide among themselves.
    orderedWeekIds.forEach((id, index) => {
      tx.update(programWeeks)
        .set({ weekIndex: index + 1 })
        .where(eq(programWeeks.id, id))
        .run();
    });

    if (slotIds.length === 0 || remap.size === 0) return;
    // Park every prescription in the offset range, then map down to its target.
    for (const old of remap.keys()) {
      tx.update(programSets)
        .set({ weekIndex: old + WEEK_REORDER_OFFSET })
        .where(
          and(
            inArray(programSets.programExerciseId, slotIds),
            eq(programSets.weekIndex, old),
          ),
        )
        .run();
    }
    for (const [old, next] of remap) {
      tx.update(programSets)
        .set({ weekIndex: next })
        .where(
          and(
            inArray(programSets.programExerciseId, slotIds),
            eq(programSets.weekIndex, old + WEEK_REORDER_OFFSET),
          ),
        )
        .run();
    }
  });
}

/** Apply superset_group changes (null clears) for a program day's exercises in one transaction. */
export function updateProgramSupersets(
  updates: { id: number; supersetGroup: number | null }[],
): void {
  db.transaction((tx) => {
    for (const update of updates) {
      tx.update(programExercises)
        .set({ supersetGroup: update.supersetGroup })
        .where(eq(programExercises.id, update.id))
        .run();
    }
  });
}

export interface ProgramSetRow {
  id: number;
  weekIndex: number;
  setNumber: number;
  reps: number;
  intensityKind: 'abs' | 'pct' | 'rpe';
  intensityValue: number;
  amrap: boolean;
  restSec: number | null;
}

export function useProgramSets(programExerciseId: number) {
  return useLiveQuery(
    db
      .select({
        id: programSets.id,
        weekIndex: programSets.weekIndex,
        setNumber: programSets.setNumber,
        reps: programSets.reps,
        intensityKind: programSets.intensityKind,
        intensityValue: programSets.intensityValue,
        amrap: programSets.amrap,
        restSec: programSets.restSec,
      })
      .from(programSets)
      .where(eq(programSets.programExerciseId, programExerciseId))
      .orderBy(programSets.weekIndex, programSets.setNumber),
    [programExerciseId],
  );
}

export function removeProgramSet(id: number): void {
  db.delete(programSets).where(eq(programSets.id, id)).run();
}

/**
 * Pre-fill one program day's prescribed sets into a session (caller is inside the
 * insert transaction). This week's prescriptions win (percent/rpe waves); lp/dp
 * fall back to rendering identical sets from the working-weight state.
 */
function seedProgramDaySets(
  sessionId: number,
  dayId: number,
  weekIndex: number,
  roundingStepKg: number,
): void {
  const plan = db
    .select({
      programExerciseId: programExercises.id,
      exerciseId: programExercises.exerciseId,
      targetSets: programExercises.targetSets,
      currentWeightKg: exerciseTrainingState.currentWeightKg,
      currentReps: exerciseTrainingState.currentReps,
      successStreak: exerciseTrainingState.successStreak,
      failStreak: exerciseTrainingState.failStreak,
      trainingMaxKg: exerciseTrainingState.trainingMaxKg,
      e1rmKg: exerciseTrainingState.e1rmKg,
    })
    .from(programExercises)
    .innerJoin(
      exerciseTrainingState,
      eq(exerciseTrainingState.programExerciseId, programExercises.id),
    )
    .where(eq(programExercises.programDayId, dayId))
    .orderBy(programExercises.position)
    .all();

  for (const slot of plan) {
    const prescribed = db
      .select({
        reps: programSets.reps,
        intensityKind: programSets.intensityKind,
        intensityValue: programSets.intensityValue,
        amrap: programSets.amrap,
      })
      .from(programSets)
      .where(
        and(
          eq(programSets.programExerciseId, slot.programExerciseId),
          eq(programSets.weekIndex, weekIndex),
        ),
      )
      .orderBy(programSets.setNumber)
      .all();

    const sets: { reps: number; weightKg: number }[] =
      prescribed.length > 0
        ? prescribed.map((p) =>
            renderPrescribedSet(p, {
              currentWeightKg: slot.currentWeightKg,
              trainingMaxKg: slot.trainingMaxKg,
              e1rmKg: slot.e1rmKg,
              stepKg: roundingStepKg,
            }),
          )
        : suggestNext(
            {
              currentWeightKg: slot.currentWeightKg,
              currentReps: slot.currentReps,
              successStreak: slot.successStreak,
              failStreak: slot.failStreak,
            },
            slot.targetSets,
          );

    sets.forEach((set, index) => {
      addSet({
        sessionId,
        exerciseId: slot.exerciseId,
        setNumber: index + 1,
        reps: set.reps,
        weight: set.weightKg,
      });
    });
  }
}

/**
 * Start a session from a program's cursor: the current week + day decide which
 * exercises and prescriptions to pre-fill. Stamps the cycle so the roadmap can
 * scope done/skipped to this pass. Returns the new session id.
 */
export function startProgramWorkout(programId: number): number {
  const program = db
    .select({
      currentWeek: programs.currentWeek,
      currentDayIndex: programs.currentDayIndex,
      currentCycle: programs.currentCycle,
      roundingStepKg: programs.roundingStepKg,
    })
    .from(programs)
    .where(eq(programs.id, programId))
    .all()[0];
  if (program == null) throw new Error(`Program ${programId} not found`);

  const weekIndex = program.currentWeek;
  const day = db
    .select({ id: programDays.id })
    .from(programDays)
    .where(
      and(
        eq(programDays.programId, programId),
        eq(programDays.dayIndex, program.currentDayIndex),
      ),
    )
    .all()[0];

  // Atomic: the session row and every prescribed set row commit together.
  return db.transaction(() => {
    const result = db
      .insert(workoutSessions)
      .values({
        programId,
        programWeekIndex: weekIndex,
        programDayIndex: program.currentDayIndex,
        programCycle: program.currentCycle,
        programDayId: day?.id ?? null,
      })
      .run();
    const sessionId = result.lastInsertRowId;
    if (day == null) return sessionId;

    seedProgramDaySets(sessionId, day.id, weekIndex, program.roundingStepKg);
    return sessionId;
  });
}

/**
 * Back-fill a specific past/skipped program day (current cycle) — pinned to the
 * given week + day rather than the cursor, so it records the missed workout
 * WITHOUT advancing the cursor (`finishWorkout` only advances the cursor's own
 * day). `startedAt` (ms) backdates it onto its calendar date.
 */
export function startProgramWorkoutFor(
  programId: number,
  weekIndex: number,
  dayIndex: number,
  startedAt?: number,
): number {
  const program = db
    .select({
      currentCycle: programs.currentCycle,
      roundingStepKg: programs.roundingStepKg,
    })
    .from(programs)
    .where(eq(programs.id, programId))
    .all()[0];
  if (program == null) throw new Error(`Program ${programId} not found`);

  const day = db
    .select({ id: programDays.id })
    .from(programDays)
    .where(
      and(
        eq(programDays.programId, programId),
        eq(programDays.dayIndex, dayIndex),
      ),
    )
    .all()[0];

  return db.transaction(() => {
    const result = db
      .insert(workoutSessions)
      .values({
        programId,
        programWeekIndex: weekIndex,
        programDayIndex: dayIndex,
        programCycle: program.currentCycle,
        programDayId: day?.id ?? null,
        ...(startedAt != null ? { startedAt: new Date(startedAt) } : {}),
      })
      .run();
    const sessionId = result.lastInsertRowId;
    if (day == null) return sessionId;

    seedProgramDaySets(sessionId, day.id, weekIndex, program.roundingStepKg);
    return sessionId;
  });
}

/**
 * After a finished program session, fold each exercise's completed sets into its
 * progression state, then advance the cursor one day (wrapping week/cycle).
 * Exercises with no completed set are left untouched (a skip is not a failure);
 * a deload week advances the cursor but applies no progression.
 */
export function advanceProgram(
  programId: number,
  programDayId: number,
  weekIndex: number,
  sessionId: number,
): void {
  const week = db
    .select({ isDeload: programWeeks.isDeload })
    .from(programWeeks)
    .where(
      and(
        eq(programWeeks.programId, programId),
        eq(programWeeks.weekIndex, weekIndex),
      ),
    )
    .all()[0];
  const isDeload = week?.isDeload ?? false;

  const slots = db
    .select()
    .from(programExercises)
    .where(eq(programExercises.programDayId, programDayId))
    .all();

  if (!isDeload) {
    for (const slot of slots) {
      // Percent schemes don't move per session — TM bumps on the cycle wrap (`bumpTrainingMaxes`).
      if (slot.schemeType === 'percent') continue;

      const logged = db
        .select({
          setNumber: setLogs.setNumber,
          reps: setLogs.reps,
          weight: setLogs.weight,
          rpe: setLogs.rpe,
        })
        .from(setLogs)
        .where(
          and(
            eq(setLogs.sessionId, sessionId),
            eq(setLogs.exerciseId, slot.exerciseId),
            // Only working sets drive progression.
            eq(setLogs.setType, 'working'),
            isNotNull(setLogs.completedAt),
          ),
        )
        .orderBy(setLogs.setNumber)
        .all();
      if (logged.length === 0) continue; // untouched this session → leave as-is.

      const stateRow = db
        .select()
        .from(exerciseTrainingState)
        .where(eq(exerciseTrainingState.programExerciseId, slot.id))
        .all()[0];
      if (stateRow == null) continue;

      // The rpe re-anchor needs each set's *prescribed* RPE (pre-filled sets log
      // none), so load this week's rpe prescriptions keyed by set number.
      const prescribedRpe = new Map<number, number>();
      if (slot.schemeType === 'rpe') {
        for (const p of db
          .select({
            setNumber: programSets.setNumber,
            intensityValue: programSets.intensityValue,
          })
          .from(programSets)
          .where(
            and(
              eq(programSets.programExerciseId, slot.id),
              eq(programSets.weekIndex, weekIndex),
              eq(programSets.intensityKind, 'rpe'),
            ),
          )
          .all()) {
          prescribedRpe.set(p.setNumber, p.intensityValue);
        }
      }

      const result = advanceSlot(
        {
          schemeType: slot.schemeType,
          incrementKg: slot.incrementKg,
          minReps: slot.minReps,
          maxReps: slot.maxReps,
          failThreshold: slot.failThreshold,
          deloadPct: slot.deloadPct,
          targetSets: slot.targetSets,
          targetRpe: slot.targetRpe,
        },
        {
          currentWeightKg: stateRow.currentWeightKg,
          currentReps: stateRow.currentReps,
          successStreak: stateRow.successStreak,
          failStreak: stateRow.failStreak,
        },
        logged.map((s) => ({
          setNumber: s.setNumber,
          reps: s.reps,
          weightKg: s.weight,
          rpe: s.rpe,
        })),
        prescribedRpe,
      );

      db.update(exerciseTrainingState)
        .set(
          result.kind === 'e1rm'
            ? { e1rmKg: result.e1rmKg, lastReason: result.reason }
            : {
                currentWeightKg: result.state.currentWeightKg,
                currentReps: result.state.currentReps,
                successStreak: result.state.successStreak,
                failStreak: result.state.failStreak,
                lastReason: result.reason,
              },
        )
        .where(eq(exerciseTrainingState.id, stateRow.id))
        .run();
    }
  }

  advanceProgramCursor(programId);
}

function advanceProgramCursor(programId: number): void {
  const program = db
    .select({
      currentWeek: programs.currentWeek,
      currentDayIndex: programs.currentDayIndex,
      currentCycle: programs.currentCycle,
    })
    .from(programs)
    .where(eq(programs.id, programId))
    .all()[0];
  if (program == null) return;

  const dayCount = db
    .select({ id: programDays.id })
    .from(programDays)
    .where(eq(programDays.programId, programId))
    .all().length;
  const weekCount = db
    .select({ id: programWeeks.id })
    .from(programWeeks)
    .where(eq(programWeeks.programId, programId))
    .all().length;

  const next = advanceCursor(
    {
      currentWeek: program.currentWeek,
      currentDayIndex: program.currentDayIndex,
      currentCycle: program.currentCycle,
    },
    dayCount,
    weekCount,
  );

  db.update(programs)
    .set({
      currentWeek: next.currentWeek,
      currentDayIndex: next.currentDayIndex,
      currentCycle: next.currentCycle,
    })
    .where(eq(programs.id, programId))
    .run();

  // A completed cycle bumps each percent slot's training max (the 5/3/1 wave),
  // independent of whether the final week was a deload.
  if (next.currentCycle > program.currentCycle) {
    bumpTrainingMaxes(programId);
  }
}

function bumpTrainingMaxes(programId: number): void {
  const slots = db
    .select({
      id: programExercises.id,
      tmIncrementKg: programExercises.tmIncrementKg,
      trainingMaxKg: exerciseTrainingState.trainingMaxKg,
    })
    .from(programExercises)
    .innerJoin(
      exerciseTrainingState,
      eq(exerciseTrainingState.programExerciseId, programExercises.id),
    )
    .where(
      and(
        eq(programExercises.programId, programId),
        eq(programExercises.schemeType, 'percent'),
      ),
    )
    .all();

  for (const slot of slots) {
    if (slot.trainingMaxKg == null) continue;
    db.update(exerciseTrainingState)
      .set({
        trainingMaxKg: slot.trainingMaxKg + slot.tmIncrementKg,
        lastReason: `+${slot.tmIncrementKg} kg training max — new cycle`,
      })
      .where(eq(exerciseTrainingState.programExerciseId, slot.id))
      .run();
  }
}
