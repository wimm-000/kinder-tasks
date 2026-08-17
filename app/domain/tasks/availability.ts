import { Temporal } from "@js-temporal/polyfill";

export interface TaskAvailabilityInput {
  type: "one_off" | "recurring" | "open";
  recurrenceUnit?: "daily" | "weekly" | "monthly" | null;
  recurrenceInterval?: number | null;
  recurrenceWeekday?: number | null;
  recurrenceMonthDay?: number | null;
  openLimitPeriod?: "day" | "week" | "month" | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
}

function weekStart(date: Temporal.PlainDate) {
  return date.subtract({ days: date.dayOfWeek - 1 });
}

function monthsBetween(start: Temporal.PlainDate, current: Temporal.PlainDate) {
  return (current.year - start.year) * 12 + current.month - start.month;
}

export function getTaskPeriod(
  input: TaskAvailabilityInput,
  now = new Date(),
  timezone = "Europe/Madrid",
) {
  if (input.startsAt && now < input.startsAt) return null;
  if (input.endsAt && now > input.endsAt) return null;
  if (input.type === "one_off") return { key: "once", occurrenceLimit: 1 };

  const date = Temporal.Instant.fromEpochMilliseconds(now.getTime())
    .toZonedDateTimeISO(timezone)
    .toPlainDate();
  const start = input.startsAt
    ? Temporal.Instant.fromEpochMilliseconds(input.startsAt.getTime())
        .toZonedDateTimeISO(timezone)
        .toPlainDate()
    : date;

  if (input.type === "open") {
    if (input.openLimitPeriod === "week")
      return { key: `week:${weekStart(date)}`, occurrenceLimit: 1 };
    if (input.openLimitPeriod === "month")
      return { key: `month:${date.toString().slice(0, 7)}`, occurrenceLimit: 1 };
    return { key: `day:${date}`, occurrenceLimit: 1 };
  }

  const interval = input.recurrenceInterval ?? 1;
  if (input.recurrenceUnit === "weekly") {
    if (input.recurrenceWeekday && date.dayOfWeek !== input.recurrenceWeekday) return null;
    const weeks = Math.floor(start.until(date, { largestUnit: "weeks" }).weeks);
    if (weeks < 0 || weeks % interval !== 0) return null;
    return { key: `week:${weekStart(date)}`, occurrenceLimit: 1 };
  }
  if (input.recurrenceUnit === "monthly") {
    const dueDay = Math.min(input.recurrenceMonthDay ?? start.day, date.daysInMonth);
    if (date.day !== dueDay || monthsBetween(start, date) % interval !== 0) return null;
    return { key: `month:${date.toString().slice(0, 7)}`, occurrenceLimit: 1 };
  }
  const days = start.until(date, { largestUnit: "days" }).days;
  if (days < 0 || days % interval !== 0) return null;
  return { key: `day:${date}`, occurrenceLimit: 1 };
}
