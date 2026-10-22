import { fromDate } from '@internationalized/date';

export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

export function addDays(date: Date, days: number, timeZone?: string): Date {
  if (timeZone) return fromDate(date, timeZone).add({ days }).toDate();
  const newDate = new Date(date.getTime());
  newDate.setDate(newDate.getDate() + days);
  return newDate;
}
