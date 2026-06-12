export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function addSeconds(date: Date, seconds: number): Date {
  const result = new Date(date);
  result.setSeconds(result.getSeconds() + seconds);
  return result;
}
