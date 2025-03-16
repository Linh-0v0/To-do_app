import * as dayjs from 'dayjs';
import * as weekdayPlugin from 'dayjs/plugin/weekday';

// Add the plugin before using `weekday()`
dayjs.extend(weekdayPlugin);

/**
 * Get the next occurrence of a weekday (e.g., "Mo", "We", "Fr")
 */
export function getNextOccurrence(day: string): Date | null {
  const dayMap: Record<string, number> = {
    'Su': 0, 'Mo': 1, 'Tu': 2, 'We': 3, 'Th': 4, 'Fr': 5, 'Sa': 6,
  };

  const today = dayjs();
  const targetDay = dayMap[day];

  if (targetDay === undefined) return null;

  let nextDate = today.weekday(targetDay); // Move to that day of the week

  // If it's today or in the past, move to the next week's occurrence
  if (nextDate.isBefore(today, 'day')) {
    nextDate = nextDate.add(1, 'week');
  }

  return nextDate.toDate();
}
