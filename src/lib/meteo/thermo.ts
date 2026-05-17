export const RD = 287.058;
export const CP = 1004.0;
export const EPS = 0.622;
export const LV = 2.5e6;

export function saturationVaporPressure(tC: number): number {
  return 6.112 * Math.exp((17.67 * tC) / (tC + 243.5));
}

export function saturationMixingRatio(tC: number, p: number): number {
  const e = saturationVaporPressure(tC);
  return (EPS * e) / Math.max(p - e, 0.1);
}

export function moistAdiabaticLapseRate(tC: number, p: number): number {
  const T = tC + 273.15;
  const rs = saturationMixingRatio(tC, p);
  const lrwbt = (LV * rs) / (RD * T);
  const num = ((RD * T) / (CP * p)) * (1 + lrwbt);
  const den = 1 + lrwbt * ((EPS * LV) / (CP * T));
  return num / den;
}
