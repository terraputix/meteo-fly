import type { Domain } from '@openmeteo/mapbox-layer';
import type { DomainInfo } from './om_url';

export const fetchDomainInfo = async (targetDomain: Domain): Promise<DomainInfo | null> => {
  try {
    const response = await fetch(
      `https://openmeteo.s3.amazonaws.com/data_spatial/${targetDomain.value}/latest.json`,
    );
    if (!response.ok) {
      throw new Error('Failed to fetch domain info');
    }
    const data = await response.json();
    return {
      variables: data.variables.map((v: string) => v),
      valid_times: data.valid_times,
      reference_time: data.reference_time,
    };
  } catch (error) {
    console.error('Error fetching domain info:', error);
    return null;
  }
};

export const updateWeatherLayer = (rasterTileSource: maplibregl.RasterTileSource, omUrl: string) => {
  if (!rasterTileSource) return;

  console.log('omUrl:', omUrl);
  rasterTileSource.setUrl('om://' + omUrl);
};
