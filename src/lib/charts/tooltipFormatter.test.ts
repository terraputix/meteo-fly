import { describe, expect, it } from 'vitest';
import { buildTooltipStore, createActiveState, createTooltipFormatter } from './tooltipFormatter';

describe('wind tooltip pressure coordinate', () => {
  it('snaps the hovered pressure to the nearest wind level', () => {
    const time = new Date('2026-07-16T10:00:00Z');
    const temperatureData = {
      temperatureData: [{ time, value: 20 }],
      dewpointData: [{ time, value: 12 }],
      humidityData: [{ time, value: 60 }],
      sunrise: time,
      sunset: time,
    };
    const windData = [
      { time, height: 111, pressure: 1000, speed: 10, direction: 180, source: 'model' as const },
      { time, height: 988, pressure: 900, speed: 20, direction: 270, source: 'model' as const },
    ];
    const store = buildTooltipStore(temperatureData, { cloudRects: [], rainDots: [] }, windData, []);
    const active = createActiveState();
    active.gridIndex = 2;
    active.hoveredWindPressure = 910;

    const html = createTooltipFormatter(store, active)({ value: [time.getTime(), 910] });

    expect(html).toContain('988&nbsp;m');
    expect(html).toContain('20&nbsp;km/h');
    expect(html).not.toContain('111&nbsp;m');
  });
});
