import { describe, expect, it } from 'vitest';
import { calculateThermalDiagnostics, calculateThermalStrength } from './thermal';

const KELVIN_OFFSET = 273.15;
const POISSON_EXPONENT = 0.2854;

function dryParcelTemperature(surfaceTemperature: number, pressure: number): number {
  return (surfaceTemperature + KELVIN_OFFSET) * Math.pow(pressure / 1000, POISSON_EXPONENT) - KELVIN_OFFSET;
}

describe('thermal diagnostics', () => {
  it('finds the first zero crossing above a connected buoyant layer', () => {
    const result = calculateThermalDiagnostics({
      surfaceTemperature: 20,
      surfacePressure: 1000,
      elevation: 0,
      lclHeightMeters: 1500,
      levels: [
        { pressure: 900, heightMeters: 1000, temperature: dryParcelTemperature(20, 900) - 3 },
        { pressure: 800, heightMeters: 2000, temperature: dryParcelTemperature(20, 800) - 2 },
        { pressure: 700, heightMeters: 3000, temperature: dryParcelTemperature(20, 700) + 2 },
      ],
    });

    expect(result.topHeightMeters).toBeCloseTo(2500);
    expect(result.topHeightAglMeters).toBeCloseTo(2500);
    expect(result.topPressure).toBeCloseTo(Math.sqrt(800 * 700));
    expect(result.topIsAboveProfile).toBe(false);
    expect(result.minimumThermalIndex).toBeCloseTo(-3);
    expect(result.reachesLcl).toBe(true);
  });

  it('does not connect an elevated unstable layer through a surface-based cap', () => {
    const result = calculateThermalDiagnostics({
      surfaceTemperature: 20,
      surfacePressure: 1000,
      elevation: 0,
      lclHeightMeters: 1500,
      levels: [
        { pressure: 900, heightMeters: 1000, temperature: dryParcelTemperature(20, 900) + 2 },
        { pressure: 800, heightMeters: 2000, temperature: dryParcelTemperature(20, 800) - 2 },
      ],
    });

    expect(result.topHeightMeters).toBeNull();
    expect(result.minimumThermalIndex).toBeNull();
    expect(result.reachesLcl).toBeNull();
  });

  it('marks lift continuing beyond the available native profile', () => {
    const result = calculateThermalDiagnostics({
      surfaceTemperature: 20,
      surfacePressure: 1000,
      elevation: 500,
      lclHeightMeters: 3000,
      levels: [
        { pressure: 900, heightMeters: 1200, temperature: dryParcelTemperature(20, 900) - 2 },
        { pressure: 800, heightMeters: 2200, temperature: dryParcelTemperature(20, 800) - 1 },
      ],
    });

    expect(result.topHeightMeters).toBe(2200);
    expect(result.topHeightAglMeters).toBe(1700);
    expect(result.topIsAboveProfile).toBe(true);
    expect(result.reachesLcl).toBeNull();
  });

  it('uses the native level above the chart ceiling only to bracket the result', () => {
    const result = calculateThermalDiagnostics({
      surfaceTemperature: 20,
      surfacePressure: 1000,
      elevation: 0,
      lclHeightMeters: 3500,
      maximumHeightMeters: 3000,
      levels: [
        { pressure: 800, heightMeters: 2000, temperature: dryParcelTemperature(20, 800) - 4 },
        { pressure: 700, heightMeters: 4000, temperature: dryParcelTemperature(20, 700) + 2 },
      ],
    });

    expect(result.topHeightMeters).toBe(3000);
    expect(result.topIsAboveProfile).toBe(true);
    expect(result.levels.at(-1)?.heightMeters).toBe(3000);
    expect(result.reachesLcl).toBeNull();
  });

  it('uses the warmest intervening requirement as the trigger temperature', () => {
    const result = calculateThermalDiagnostics({
      surfaceTemperature: 15,
      surfacePressure: 1000,
      elevation: 0,
      lclHeightMeters: 2000,
      levels: [
        { pressure: 900, heightMeters: 1000, temperature: 15 },
        { pressure: 800, heightMeters: 2000, temperature: 0 },
      ],
    });

    expect(result.triggerTemperature).not.toBeNull();
    expect(result.triggerTemperature).toBeGreaterThan(23);
  });

  it('returns unavailable diagnostics for invalid surface data', () => {
    const result = calculateThermalDiagnostics({
      surfaceTemperature: NaN,
      surfacePressure: 1000,
      elevation: 0,
      lclHeightMeters: 1000,
      levels: [],
    });

    expect(result.levels).toEqual([]);
    expect(result.topHeightMeters).toBeNull();
  });
});

describe('thermal strength', () => {
  it('calculates the Deardorff convective velocity scale from GFS surface fluxes', () => {
    const result = calculateThermalStrength({
      surfaceTemperature: 20,
      surfaceDewpoint: 10,
      surfacePressure: 1000,
      boundaryLayerHeightAglMeters: 1500,
      sensibleHeatFlux: 200,
      latentHeatFlux: 100,
    });

    expect(result?.convectiveVelocityScale).toBeCloseTo(2.06, 2);
    expect(result?.boundaryLayerHeightAglMeters).toBe(1500);
    expect(result?.surfaceBuoyancyFlux).toBeGreaterThan(0);
  });

  it('omits the strength estimate without positive surface heating', () => {
    expect(
      calculateThermalStrength({
        surfaceTemperature: 15,
        surfaceDewpoint: 10,
        surfacePressure: 950,
        boundaryLayerHeightAglMeters: 1000,
        sensibleHeatFlux: 0,
        latentHeatFlux: 100,
      })
    ).toBeNull();
  });

  it('can calculate a dry estimate when latent heat flux is missing', () => {
    const result = calculateThermalStrength({
      surfaceTemperature: 20,
      surfaceDewpoint: NaN,
      surfacePressure: 1000,
      boundaryLayerHeightAglMeters: 1500,
      sensibleHeatFlux: 200,
      latentHeatFlux: NaN,
    });

    expect(result?.convectiveVelocityScale).toBeGreaterThan(0);
  });
});
