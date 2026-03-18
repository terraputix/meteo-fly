<script lang="ts">
  import { windDomains, windColors, windMaxSpeed } from '$lib/charts/scales';
</script>

<div class="legend">
  <!-- Cloud Scale -->
  <div class="group">
    <span class="label">Clouds <small>%</small></span>
    <div class="bar-wrap">
      <div class="bar clouds"></div>
      <div class="ticks">
        <span>0</span><span>100</span>
      </div>
    </div>
  </div>

  <!-- Wind Scale -->
  <div class="group">
    <span class="label">Wind <small>km/h</small></span>
    <div class="bar-wrap">
      <div
        class="bar"
        style="background: linear-gradient(to right, {windDomains
          .map((d, i) => `${windColors[i]} ${((d / windMaxSpeed) * 100).toFixed(1)}%`)
          .join(', ')});"
      ></div>
      <div class="ticks">
        <span>{Math.round(windDomains[0])}</span>
        <span>{Math.round(windDomains[windDomains.length - 1])}</span>
      </div>
    </div>
  </div>
</div>

<style>
  .legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 1.5rem 2.5rem;
    padding: 1rem;
    max-width: 800px;
    margin: 0 auto;
    opacity: 0.7;
  }

  .legend:hover {
    opacity: 1;
  }

  .group {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1 1 180px; /* Grow, Shrink, Basis (Minimum width before wrapping) */
    min-width: 140px;
  }

  .label {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #888;
    white-space: nowrap;
  }

  .label small {
    text-transform: lowercase;
    opacity: 0.6;
    margin-left: 1px;
  }

  .bar-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .bar {
    height: 5px;
    border-radius: 4px;
    width: 100%;
  }

  .bar.clouds {
    background: linear-gradient(
      to right,
      rgba(100, 120, 145, 0),
      rgba(100, 120, 145, 0.45) 50%,
      rgba(100, 120, 145, 0.85)
    );
    border: 0.5px solid #e2e8f0;
  }

  .ticks {
    display: flex;
    justify-content: space-between;
    font-size: 0.6rem;
    color: #aaa;
    font-family: tabular-nums;
  }

  @media (max-width: 450px) {
    .legend {
      gap: 1rem;
    }
    .group {
      flex-basis: 100%; /* Forces stack on very small screens */
    }
  }
</style>
