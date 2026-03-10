<script lang="ts">
  import { windDomains, windColors, windMaxSpeed } from '$lib/charts/scales';

  // Generate cloud cover gradient stops
  const cloudStops = [
    { pct: 0, color: 'white' },
    { pct: 100, color: 'gray' },
  ];

  const cloudGradient = `linear-gradient(to right, ${cloudStops.map((s) => `${s.color} ${s.pct}%`).join(', ')})`;

  // Wind speed legend: build gradient from domain/range pairs
  const windGradientStops = windDomains
    .map((d, i) => {
      const pct = (d / windMaxSpeed) * 100;
      return `${windColors[i]} ${pct.toFixed(1)}%`;
    })
    .join(', ');
  const windGradient = `linear-gradient(to right, ${windGradientStops})`;

  const windTickValues = windDomains;
</script>

<div class="legend-container">
  <!-- Cloud Cover Legend -->
  <div class="legend-item">
    <div class="legend-label">Cloud Cover (%)</div>
    <div class="legend-bar-wrap">
      <div class="legend-bar" style="background: {cloudGradient};"></div>
      <div class="legend-ticks">
        <span>0</span>
        <span>25</span>
        <span>50</span>
        <span>75</span>
        <span>100</span>
      </div>
    </div>
  </div>

  <!-- Wind Speed Legend -->
  <div class="legend-item">
    <div class="legend-label">Wind Speed (km/h)</div>
    <div class="legend-bar-wrap">
      <div class="legend-bar" style="background: {windGradient};"></div>
      <div class="legend-ticks">
        {#each windTickValues as val}
          <span>{Math.round(val)}</span>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .legend-container {
    display: flex;
    flex-wrap: wrap;
    margin: 1rem auto;
    justify-content: center;
    align-items: flex-start;
    gap: 1.5rem;
    padding: 0 1rem;
  }

  .legend-item {
    flex: 1 1 200px;
    max-width: 340px;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .legend-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #555;
    text-align: center;
  }

  .legend-bar-wrap {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .legend-bar {
    height: 14px;
    width: 100%;
    border-radius: 3px;
    border: 1px solid #ccc;
  }

  .legend-ticks {
    display: flex;
    justify-content: space-between;
    font-size: 0.65rem;
    color: #666;
    padding: 0 1px;
  }
</style>
