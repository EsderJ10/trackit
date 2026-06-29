// Barrel for the gym query layer. `advanceProgram` is intentionally NOT
// re-exported — it's an internal progression hook shared between `sessions` and
// `programs`, never public.

export * from './routines';
export * from './settings';
export * from './exercises';
export * from './sessions';
export {
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
  setCurrentProgram,
  addProgramDay,
  renameProgramDay,
  removeProgramDay,
  duplicateProgramDay,
  addProgramWeek,
  setProgramWeekDeload,
  renameProgramWeek,
  removeProgramWeek,
  duplicateProgramWeek,
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
  type CurrentProgram,
  type NextProgramWorkout,
  type ProgramDayRow,
  type ProgramWeekRow,
  type ProgramExerciseRow,
  type ProgramSchemeChoice,
  type AddProgramExerciseInput,
  type ProgramSetRow,
} from './programs';
