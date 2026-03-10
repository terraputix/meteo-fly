<script lang="ts">
  import { windDomains, windColors, windMaxSpeed } from '$lib/charts/scales';
  import { LEGEND_ITEMS } from '$lib/charts/chartColors';
</script>

<div class="legend-outer">
  <!-- Row 1: Line series -->
  <div class="legend-section">
    <span class="legend-title">Lines</span>
    <div class="legend-items-row">
      {#each LEGEND_ITEMS as item}
        <span class="legend-item">
          {#if item.style === 'solid'}
            <span class="legend-line" style="background:{item.color}"></span>
          {:else if item.style === 'dashed'}
            <span class="legend-dashed" style="border-color:{item.color}"></span>
          {:else if item.style === 'emoji'}
            <span class="legend-raindrop">{item.emoji}</span>
          {/if}
          {item.label}
        </span>
      {/each}
    </div>
  </div>

  <!-- Row 2: Cloud cover -->
  <div class="legend-section">
    <span class="legend-title">Cloud Cover</span>
    <div class="legend-gradient-wrap">
      <div
        class="legend-gradient"
        style="background:linear-gradient(to right,
          rgba(100,120,145,0) 0%,
          rgba(100,120,145,0.4) 50%,
          rgba(100,120,145,0.82) 100%);"
      ></div>
      <div class="legend-gradient-ticks">
        <span>0%</span><span>50%</span><span>100%</span>
      </div>
    </div>
    <div class="legend-bands">
      <span class="band-label" style="background:#f8f8f8">Low</span>
      <span class="band-label" style="background:#f2f2f2">Mid</span>
      <span class="band-label" style="background:#ebebeb">High</span>
      <span class="band-note">(rain panel)</span>
    </div>
  </div>

  <!-- Row 3: Wind speed -->
  <div class="legend-section">
    <span class="legend-title">Wind Speed (km/h)</span>
    <div class="legend-gradient-wrap">
      <div
        class="legend-gradient"
        style="background:linear-gradient(to right, {windDomains
          .map((d, i) => `${windColors[i]} ${((d / windMaxSpeed) * 100).toFixed(1)}%`)
          .join(', ')});"
      ></div>
      <div class="legend-gradient-ticks">
        {#each windDomains as d}
          <span>{Math.round(d)}</span>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .legend-outer {
    width: 100%;
    max-width: 1040px;
    margin: 0.5rem auto 1rem;
    padding: 0.6rem 1.2rem;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    background: #fafafa;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.72rem;
    color: #444;
  }

  .legend-section {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .legend-title {
    font-weight: 700;
    font-size: 0.7rem;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    min-width: 80px;
  }

  .legend-items-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    align-items: center;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }

  .legend-line {
    display: inline-block;
    width: 18px;
    height: 3px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .legend-dashed {
    display: inline-block;
    width: 18px;
    height: 0;
    border-top: 2.5px dashed;
    background: transparent !important;
    flex-shrink: 0;
  }

  .legend-raindrop {
    font-size: 0.85rem;
    line-height: 1;
  }

  .legend-gradient-wrap {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1 1 160px;
    max-width: 260px;
  }

  .legend-gradient {
    height: 13px;
    border-radius: 3px;
    border: 1px solid #ddd;
  }

  .legend-gradient-ticks {
    display: flex;
    justify-content: space-between;
    font-size: 0.62rem;
    color: #888;
  }

  .legend-bands {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }

  .band-label {
    padding: 1px 6px;
    border-radius: 3px;
    border: 1px solid #ddd;
    font-size: 0.68rem;
    color: #555;
  }

  .band-note {
    font-size: 0.65rem;
    color: #999;
  }

  @media (max-width: 768px) {
    .legend-outer {
      padding: 0.5rem 0.75rem;
    }
  }
</style>
