interface Date {
  /**
   * Adds the specified number of days to the current date instance.
   * @param days Number of days to add.
   * @returns A new Date instance with the days added.
   */
  addDays(days: number): Date;

  /**
   * Adds the specified number of seconds to the current date instance.
   * @param seconds Number of seconds to add.
   * @returns A new Date instance with the seconds added.
   */
  addSeconds(seconds: number): Date;
}
