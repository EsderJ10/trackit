import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Card, Icon, Text, cn, colors } from '@/ui';

import { monthGrid, startOfDay } from '../calendar';
import { dayKey } from '../streak';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export interface WorkoutCalendarProps {
  /** First day of the displayed month. */
  month: Date;
  /** Day-key → session ids for finished workouts, from `groupSessionDays`. */
  marked: Map<string, number[]>;
  /** Local start-of-today (ms); days after it are future and not selectable. */
  todayStartMs: number;
  /** Whether forward navigation is allowed (false on the current month). */
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  /** Tapped a non-future day; `sessionIds` is empty for an unlogged day. */
  onSelectDay: (date: Date, sessionIds: number[]) => void;
}

/** A month calendar marking finished-workout days; taps open or log a day. */
export function WorkoutCalendar({
  month,
  marked,
  todayStartMs,
  canGoNext,
  onPrev,
  onNext,
  onSelectDay,
}: WorkoutCalendarProps) {
  const weeks = monthGrid(month);

  return (
    <Card className="gap-3">
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={onPrev}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          hitSlop={8}
          className="h-8 w-8 items-center justify-center rounded-lg active:opacity-60"
        >
          <Icon icon={ChevronLeft} size={20} color={colors.fgMuted} />
        </Pressable>
        <Text variant="heading">
          {MONTH_NAMES[month.getMonth()]} {month.getFullYear()}
        </Text>
        <Pressable
          onPress={onNext}
          disabled={!canGoNext}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          hitSlop={8}
          className="h-8 w-8 items-center justify-center rounded-lg active:opacity-60"
          style={!canGoNext ? { opacity: 0.3 } : undefined}
        >
          <Icon icon={ChevronRight} size={20} color={colors.fgMuted} />
        </Pressable>
      </View>

      <View className="flex-row">
        {WEEKDAYS.map((day, index) => (
          <View key={index} className="flex-1 items-center">
            <Text variant="caption">{day}</Text>
          </View>
        ))}
      </View>

      <View className="gap-1">
        {weeks.map((week, weekIndex) => (
          <View key={weekIndex} className="flex-row">
            {week.map((date) => {
              const cellStart = startOfDay(date).getTime();
              const inMonth = date.getMonth() === month.getMonth();
              const isFuture = cellStart > todayStartMs;
              const isToday = cellStart === todayStartMs;
              const sessionIds = marked.get(dayKey(date)) ?? [];
              const logged = sessionIds.length > 0;

              return (
                <View key={cellStart} className="flex-1 items-center py-0.5">
                  <Pressable
                    onPress={() => onSelectDay(date, sessionIds)}
                    disabled={isFuture}
                    accessibilityRole="button"
                    accessibilityLabel={`${date.toDateString()}${
                      logged ? ', workout logged' : ''
                    }`}
                    className={cn(
                      'h-9 w-9 items-center justify-center rounded-full',
                      !isFuture && 'active:opacity-60',
                    )}
                    style={{
                      backgroundColor: logged ? colors.gym : 'transparent',
                      borderWidth: isToday && !logged ? 1 : 0,
                      borderColor: colors.gym,
                      opacity: isFuture ? 0.25 : inMonth ? 1 : 0.4,
                    }}
                  >
                    <Text
                      style={{
                        color: logged
                          ? colors.bg
                          : inMonth
                            ? colors.fg
                            : colors.fgFaint,
                        fontWeight: logged || isToday ? '700' : '400',
                      }}
                    >
                      {date.getDate()}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </Card>
  );
}
