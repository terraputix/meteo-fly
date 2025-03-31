import { describe, it, expect } from 'vitest';
import { getVariablesForModel } from './variables';
import { createHourlyParams } from './api';

describe('API Configuration', () => {
  it('should generate correct parameters for ICON-D2 model', () => {
    const variables = getVariablesForModel('icon_d2');
    const params = createHourlyParams(variables);
    expect(params.hourly).toContain('temperature_2m');
    expect(params.hourly).toContain('cloud_cover_1000hPa');
    expect(params.hourly).toContain('wind_speed_1000hPa');
  });

  it('should combine default and model-specific variables', () => {
    const variables = getVariablesForModel('icon_d2');
    const defaultVarCount = getVariablesForModel('icon_global').length;
    expect(variables.length).toBeGreaterThanOrEqual(defaultVarCount);
  });
});
