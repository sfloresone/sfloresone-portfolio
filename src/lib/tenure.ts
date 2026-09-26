/** Month key as `YYYY-MM`. */
export type MonthKey = `${number}-${number}`;

function parseMonthKey(value: MonthKey): { year: number; month: number } {
  const [yearPart, monthPart] = value.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid month key: ${value}`);
  }

  return { year, month };
}

function toMonthIndex({ year, month }: { year: number; month: number }): number {
  return year * 12 + (month - 1);
}

function formatMonthKey(value: MonthKey): string {
  const { year, month } = parseMonthKey(value);
  return `${String(month).padStart(2, "0")}.${year}`;
}

/** `07.2026 — Present` or `02.2026 — 06.2026`. */
export function formatRoleRange(start: MonthKey, end: MonthKey | null): string {
  const startLabel = formatMonthKey(start);
  const endLabel = end === null ? "Present" : formatMonthKey(end);
  return `${startLabel} — ${endLabel}`;
}

/** Inclusive tenure from start month through end month (or current month if null). */
export function formatTenure(start: MonthKey, end: MonthKey | null, now = new Date()): string {
  const startIndex = toMonthIndex(parseMonthKey(start));
  const endIndex =
    end === null
      ? toMonthIndex({ year: now.getFullYear(), month: now.getMonth() + 1 })
      : toMonthIndex(parseMonthKey(end));

  const totalMonths = Math.max(1, endIndex - startIndex + 1);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  if (years === 0) return `${months}m`;
  if (months === 0) return `${years}y`;
  return `${years}y ${months}m`;
}
