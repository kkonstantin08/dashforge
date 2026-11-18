export function isTimeZone(value: string): boolean {
  if (!value) return true;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function isBookmarkUrl(value: string): boolean {
  try {
    const { protocol, username, password } = new URL(value);
    return (protocol === 'https:' || protocol === 'http:') && !username && !password;
  } catch {
    return false;
  }
}

export function isLocalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function isLocalTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
