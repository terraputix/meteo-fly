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

    const html = createTooltipFormatter(store, active, 'UTC')({ value: [time.getTime(), 910] });

    expect(html).toContain('988&nbsp;m');
    expect(html).toContain('20&nbsp;km/h');
    expect(html).not.toContain('111&nbsp;m');
  });

  it('shows the nearby hourly precipitation summary in the rain grid', () => {
    const time = new Date('2026-07-16T10:00:00Z');
    const temperatureData = {
      temperatureData: [{ time, value: 20 }],
      dewpointData: [{ time, value: 12 }],
      humidityData: [{ time, value: 60 }],
      sunrise: time,
      sunset: time,
    };
    const precipitation = new Float32Array(25);
    precipitation[12] = 2.5;
    const store = buildTooltipStore(temperatureData, { cloudRects: [], rainDots: [] }, [], [], {
      gridSize: 5,
      radiusKm: 20,
      glyphs: [
        {
          time,
          x1: new Date('2026-07-16T09:30:00Z'),
          x2: new Date('2026-07-16T10:30:00Z'),
          precipitation,
          maximum: 2.5,
          wetCellCount: 1,
        },
      ],
    });
    const active = createActiveState();
    active.gridIndex = 1;

    const html = createTooltipFormatter(store, active, 'UTC')({ value: [time.getTime(), 1] });

    expect(html).toContain('Nearby ±20&nbsp;km (1h)');
    expect(html).toContain('max 2.5&nbsp;mm');
    expect(html).toContain('1/25 wet');
  });

  it('formats forecast time in the resolved location timezone', () => {
    const time = new Date('2026-07-16T10:30:00Z');
    const temperatureData = {
      temperatureData: [{ time, value: 20 }],
      dewpointData: [{ time, value: 12 }],
      humidityData: [{ time, value: 60 }],
      sunrise: time,
      sunset: time,
    };
    const store = buildTooltipStore(
      temperatureData,
      {
        cloudRects: [
          {
            x1: new Date(time.getTime() - 30 * 60_000),
            x2: new Date(time.getTime() + 30 * 60_000),
            y1: 0,
            y2: 1 / 3,
            cloudCover: 35,
          },
        ],
        rainDots: [{ time, rain: 1.5 }],
      },
      [],
      []
    );

    const html = createTooltipFormatter(
      store,
      createActiveState(),
      'Asia/Kolkata'
    )({
      value: [time.getTime() + 5 * 60_000, 20],
    });

    expect(html).toContain('16:00');
    expect(html).toContain('20.0&nbsp;°C');
    expect(html).toContain('35&nbsp;%');
    expect(html).toContain('1.5&nbsp;mm/h');
  });
});
