// Simple utility function to add seconds to a date
export function addSeconds(date: Date, seconds: number): Date {
  const newDate = new Date(date.getTime());
  newDate.setSeconds(newDate.getSeconds() + seconds);
  return newDate;
}

export function addDays(date: Date, days: number): Date {
  const newDate = new Date(date.getTime());
  newDate.setDate(newDate.getDate() + days);
  return newDate;
}
