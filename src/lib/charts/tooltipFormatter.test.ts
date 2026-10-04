import { describe, expect, it } from 'vitest';
import { buildTooltipStore, createActiveState, formatTooltip } from '#lib/charts/tooltipFormatter.js';

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

    const html = formatTooltip(store, active, 'UTC', time.getTime());

    expect(html).toContain('988&nbsp;m');
    expect(html).toContain('20&nbsp;km/h');
    expect(html).not.toContain('111&nbsp;m');
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

    const html = formatTooltip(store, createActiveState(), 'Asia/Kolkata', time.getTime() + 5 * 60_000);

    expect(html).toContain('16:00');
    expect(html).toContain('20.0&nbsp;°C');
    expect(html).toContain('35&nbsp;%');
    expect(html).toContain('1.5&nbsp;mm/h');
  });
});

describe('canvas tooltip selection', () => {
  const time = new Date('2026-07-16T12:00:00Z');
  const temperature = {
    temperatureData: [{ time, value: 22 }],
    dewpointData: [{ time, value: 12 }],
    humidityData: [{ time, value: 60 }],
    sunrise: time,
    sunset: time,
  };
  const store = buildTooltipStore(
    temperature,
    {
      cloudRects: [{ x1: new Date(+time - 1800000), x2: new Date(+time + 1800000), y1: 0, y2: 1 / 3, cloudCover: 35 }],
      rainDots: [{ time, rain: 2 }],
    },
    [{ time, height: 988, pressure: 900, speed: 20, direction: 270, source: 'model' }],
    [{ time, value: 1800 }]
  );

  it('shows only the selected panel while retaining the same time lookup', () => {
    const temp = formatTooltip(store, { gridIndex: 0, hoveredWindPressure: null }, 'UTC', +time + 1000);
    expect(temp).toContain('22.0');
    expect(temp).not.toContain('Rain');
    const rain = formatTooltip(store, { gridIndex: 1, hoveredWindPressure: null }, 'UTC', +time);
    expect(rain).toContain('35&nbsp;%');
    expect(rain).toContain('2.0');
    expect(rain).not.toContain('Temp');
    const wind = formatTooltip(store, { gridIndex: 2, hoveredWindPressure: 910 }, 'UTC', +time);
    expect(wind).toContain('1800');
    expect(wind).toContain('988');
    expect(wind).not.toContain('Humidity');
  });

  it('returns no tooltip when the hourly timeline is empty', () => {
    const empty = buildTooltipStore(
      { ...temperature, temperatureData: [], dewpointData: [], humidityData: [] },
      { cloudRects: [], rainDots: [] },
      [],
      []
    );
    expect(formatTooltip(empty, createActiveState(), 'UTC', +time)).toBe('');
  });
});
