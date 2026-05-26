function parseBackendDate(value: string): Date {
  const hasTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(value);
  return new Date(hasTimezone ? value : `${value}Z`);
}

export function getBackendDateTime(value: string | null): Date | null {
  if (!value) return null;
  const date = parseBackendDate(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatLocalDate(value: string | null): string {
  return getBackendDateTime(value)?.toLocaleDateString() || "";
}

export function formatLocalTime(value: string | null): string {
  return getBackendDateTime(value)?.toLocaleTimeString() || "";
}

export function formatLocalDateTime(value: string | null): string {
  return getBackendDateTime(value)?.toLocaleString() || "N/A";
}
