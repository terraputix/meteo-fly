// Check if the method already exists to prevent overwriting
if (!Date.prototype.addDays) {
  Date.prototype.addDays = function (days: number): Date {
    const date = new Date(this.valueOf());
    date.setDate(date.getDate() + days);
    return date;
  };
}

if (!Date.prototype.addSeconds) {
  Date.prototype.addSeconds = function (seconds: number): Date {
    const date = new Date(this.valueOf());
    date.setSeconds(date.getSeconds() + seconds);
    return date;
  };
}
