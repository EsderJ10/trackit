// Barrel for the gym query layer. Existing consumers import from
// `'../queries'` / `'./queries'`, which now resolve to this directory; this
// file re-exports the entire public surface so those paths keep working.
//
// `advanceProgram` is intentionally NOT re-exported: it is an internal
// progression hook shared between `sessions` (finishWorkout) and `programs`,
// and was never part of the public surface.

export * from './routines';
export * from './settings';
export * from './exercises';
export * from './sessions';
export {
  // Hooks
  useActivePrograms,
  useProgram,
  useCurrentProgram,
  useNextProgramWorkout,
  useAllProgramDays,
  useProgramDays,
  useProgramWeeks,
  useProgramExercises,
  useProgramDayExercises,
  useProgramSets,
  // Mutations
  setCurrentProgram,
  addProgramDay,
  renameProgramDay,
  removeProgramDay,
  addProgramWeek,
  setProgramWeekDeload,
  renameProgramWeek,
  removeProgramWeek,
  generateProgramWave,
  createProgram,
  renameProgram,
  deleteProgram,
  addProgramExercise,
  setProgramExerciseWeight,
  setProgramExerciseTrainingMax,
  setProgramExerciseE1rm,
  removeProgramExercise,
  reorderProgramExercises,
  updateProgramSupersets,
  removeProgramSet,
  startProgramWorkout,
  // Types
  type CurrentProgram,
  type NextProgramWorkout,
  type ProgramDayRow,
  type ProgramWeekRow,
  type ProgramExerciseRow,
  type ProgramSchemeChoice,
  type AddProgramExerciseInput,
  type ProgramSetRow,
} from './programs';
