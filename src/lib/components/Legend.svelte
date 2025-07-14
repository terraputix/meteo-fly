<script lang="ts">
  import { legend, type ScaleOptions } from '@observablehq/plot';
  import { cloudCoverScaleOptions, windSpeedScaleOptions } from '$lib/charts/scales';

  function renderLegend(node: HTMLElement, scaleOptions: ScaleOptions) {
    const legendItem = legend({ color: scaleOptions });
    node.appendChild(legendItem);

    return {
      destroy() {
        node.innerHTML = '';
      },
    };
  }
</script>

<div class="legend-container">
  <div use:renderLegend={cloudCoverScaleOptions} class="legend-item"></div>
  <div use:renderLegend={windSpeedScaleOptions} class="legend-item"></div>
</div>

<style>
  .legend-container {
    display: flex;
    flex-wrap: wrap;
    margin: 1rem auto;
    justify-content: center;
    align-items: center;
    gap: 1rem;
  }

  .legend-item {
    flex: 1 1 auto;
    margin: 0 2.5rem;
    max-width: 60%;
  }

  .legend-item :global(svg) {
    width: 100%;
    height: auto;
  }
</style>
