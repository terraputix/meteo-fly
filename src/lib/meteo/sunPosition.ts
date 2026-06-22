const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

function julianDay(date: Date): number {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return (
    d +
    Math.floor((153 * mm + 2) / 5) +
    365 * yy +
    Math.floor(yy / 4) -
    Math.floor(yy / 100) +
    Math.floor(yy / 400) -
    32045
  );
}

export function calcSunPosition(lat: number, lon: number, date: Date): { azimuth: number; elevation: number } {
  const jd = julianDay(date);
  const n = jd - 2451545 + (date.getUTCHours() - 12 + date.getUTCMinutes() / 60) / 24;

  const M = (357.5291 + 0.98560028 * n) % 360;
  const C = 1.9148 * Math.sin(M * DEG) + 0.02 * Math.sin(2 * M * DEG) + 0.0003 * Math.sin(3 * M * DEG);
  const lambda = (M + C + 180 + 102.9372) % 360;

  const epsilon = 23.439291 - 0.00000036 * n;

  const ra = RAD * Math.atan2(Math.cos(epsilon * DEG) * Math.sin(lambda * DEG), Math.cos(lambda * DEG));
  const dec = RAD * Math.asin(Math.sin(epsilon * DEG) * Math.sin(lambda * DEG));

  const gha = 280.46061837 + 360.98564736629 * n - ra;
  let lha = (gha + lon) % 360;
  if (lha > 180) lha -= 360;

  const latRad = lat * DEG;
  const decRad = dec * DEG;
  const lhaRad = lha * DEG;

  const elev =
    RAD * Math.asin(Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(lhaRad));

  const az =
    RAD * Math.atan2(-Math.sin(lhaRad), Math.sin(latRad) * Math.cos(lhaRad) - Math.tan(decRad) * Math.cos(latRad));
  const azimuth = (180 - az) % 360;

  return { azimuth, elevation: elev };
}
