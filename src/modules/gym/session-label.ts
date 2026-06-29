// Single source of truth for a session's label. Precedence: program (day name +
// "Week X of Y") > routine (its name) > "Freestyle" (ad-hoc).
export interface SessionLabelFields {
  routineName: string | null;
  programName: string | null;
  programDayName: string | null;
  programWeekIndex: number | null;
  programLengthWeeks: number | null;
}

export interface SessionLabel {
  /** Primary line: program day name, routine name, or "Freestyle". */
  title: string;
  /** Secondary line for program sessions, e.g. "Week 2 of 6"; else undefined. */
  subtitle?: string;
}

export function sessionLabel(s: SessionLabelFields): SessionLabel {
  if (s.programName != null) {
    return {
      title: s.programDayName ?? s.programName,
      subtitle:
        s.programWeekIndex != null && s.programLengthWeeks != null
          ? `Week ${s.programWeekIndex} of ${s.programLengthWeeks}`
          : undefined,
    };
  }
  if (s.routineName != null) return { title: s.routineName };
  return { title: 'Freestyle' };
}

/** Flattened single-line label (e.g. "Push · Week 2 of 6") for compact rows. */
export function sessionLabelLine(s: SessionLabelFields): string {
  const { title, subtitle } = sessionLabel(s);
  return subtitle ? `${title} · ${subtitle}` : title;
}
