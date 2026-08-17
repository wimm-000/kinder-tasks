import { Temporal } from "@js-temporal/polyfill";

export type AllowanceCalendar =
  | { frequency: "weekly"; weekday: number; monthDay?: null }
  | { frequency: "monthly"; monthDay: number; weekday?: null };

function monthlyDate(year: number, month: number, day: number) {
  const first = Temporal.PlainDate.from({ year, month, day: 1 });
  return first.with({ day: Math.min(day, first.daysInMonth) });
}

export function firstDueDate(config: AllowanceCalendar, startDate: string) {
  const start = Temporal.PlainDate.from(startDate);
  if (config.frequency === "weekly")
    return start.add({ days: (config.weekday - start.dayOfWeek + 7) % 7 });
  let candidate = monthlyDate(start.year, start.month, config.monthDay);
  if (Temporal.PlainDate.compare(candidate, start) < 0) {
    const next = start.add({ months: 1 }).with({ day: 1 });
    candidate = monthlyDate(next.year, next.month, config.monthDay);
  }
  return candidate;
}

export function nextDueDate(config: AllowanceCalendar, previousDate: string) {
  const previous = Temporal.PlainDate.from(previousDate);
  if (config.frequency === "weekly") return previous.add({ days: 7 });
  const nextMonth = previous.with({ day: 1 }).add({ months: 1 });
  return monthlyDate(nextMonth.year, nextMonth.month, config.monthDay);
}

export function dueDateToDate(date: Temporal.PlainDate, timezone = "Europe/Madrid") {
  return new Date(
    date.toZonedDateTime({ timeZone: timezone, plainTime: "00:00" }).epochMilliseconds,
  );
}

export function dateToLocalDate(date: Date, timezone = "Europe/Madrid") {
  return Temporal.Instant.fromEpochMilliseconds(date.getTime())
    .toZonedDateTimeISO(timezone)
    .toPlainDate();
}

export function allowancePeriodKey(frequency: "weekly" | "monthly", date: Temporal.PlainDate) {
  return frequency === "weekly" ? date.toString() : date.toString().slice(0, 7);
}
