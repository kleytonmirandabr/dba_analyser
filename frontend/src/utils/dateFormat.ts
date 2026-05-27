/**
 * Format a UTC date string to the client's timezone and format.
 */
export function formatDate(utcDate: string | Date | null | undefined, timezone?: string, dateFormat?: string, timeFormat?: string): string {
  if (!utcDate) return '-';
  const tz = timezone || localStorage.getItem('dba-timezone') || 'America/Sao_Paulo';
  const df = dateFormat || localStorage.getItem('dba-dateFormat') || 'DD/MM/YYYY';
  const tf = timeFormat || localStorage.getItem('dba-timeFormat') || '24h';

  const date = new Date(utcDate);
  if (isNaN(date.getTime())) return '-';

  const options: Intl.DateTimeFormatOptions = {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: tf === '12h',
  };

  try {
    const formatted = new Intl.DateTimeFormat('pt-BR', options).format(date);
    return formatted;
  } catch {
    return date.toLocaleString();
  }
}

export function formatDateOnly(utcDate: string | Date | null | undefined, timezone?: string): string {
  if (!utcDate) return '-';
  const tz = timezone || localStorage.getItem('dba-timezone') || 'America/Sao_Paulo';
  const date = new Date(utcDate);
  if (isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function formatTimeOnly(utcDate: string | Date | null | undefined, timezone?: string, timeFormat?: string): string {
  if (!utcDate) return '-';
  const tz = timezone || localStorage.getItem('dba-timezone') || 'America/Sao_Paulo';
  const tf = timeFormat || localStorage.getItem('dba-timeFormat') || '24h';
  const date = new Date(utcDate);
  if (isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: tf === '12h' }).format(date);
}
