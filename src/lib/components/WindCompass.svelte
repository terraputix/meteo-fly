<script lang="ts">
  import type { Map as ForecastMap, Marker } from 'maplibre-gl';
  import { onDestroy, untrack } from 'svelte';
  import type { CompassModel } from '#lib/api/models.js';
  import {
    DEFAULT_WIND_COMPARISON_LEVEL,
    formatWindComparisonLevel,
    type WindComparisonLevel,
  } from '#lib/api/forecastFields.js';
  import { windCompassRimPoint } from '#lib/meteo/surfaceWind.js';
  import { windColorScale } from '#lib/charts/scales.js';
  import { windDirectionLabel } from '#lib/meteo/wind.js';
  import { isMobile } from '#lib/stores/media.js';
  import { units } from '#lib/stores/units.js';
  import { windSpeed } from '#lib/utils/units.js';

  let {
    rows,
    level,
    map,
    marker,
    latitude,
    longitude,
    highlighted,
    onInspectModels,
  }: {
    rows: { id: CompassModel; name: string; bearing: number | null; speed: number; gust: number }[];
    level: WindComparisonLevel;
    map: ForecastMap;
    marker: Marker;
    latitude: number;
    longitude: number;
    highlighted: CompassModel | null;
    onInspectModels: (models: CompassModel[]) => void;
  } = $props();

  const tail = -108;
  const tip = 20;
  const showGusts = $derived(level === DEFAULT_WIND_COMPARISON_LEVEL);
  const levelLabel = $derived(formatWindComparisonLevel(level, $units));

  let hovered = $state<CompassModel[]>([]);
  let focused = $state<CompassModel | null>(null);
  const active = $derived(hovered.length ? hovered : [focused ?? highlighted]);
  let svg: SVGSVGElement;

  function inspectPointer(event: PointerEvent) {
    const ids = new Set(
      document
        .elementsFromPoint(event.clientX, event.clientY)
        .map((element) => element.closest('[data-wind-compass-label]'))
        .filter((label) => label && svg.contains(label))
        .map((label) => label?.getAttribute('data-wind-compass-label'))
    );
    const models = rows.filter(({ id }) => ids.has(id)).map(({ id }) => id);
    if (models.length !== hovered.length || models.some((id, i) => id !== hovered[i])) hovered = models;
  }

  let projectionRevision = $state(0);
  $effect(() => {
    marker.setLngLat([longitude, latitude]);
    const refresh = () => projectionRevision++;
    untrack(refresh);
    map.on('move', refresh);
    map.on('moveend', refresh);
    map.on('resize', refresh);
    map.on('idle', refresh);
    return () => {
      map.off('move', refresh);
      map.off('moveend', refresh);
      map.off('resize', refresh);
      map.off('idle', refresh);
    };
  });

  const anchor = $derived.by(() => {
    void projectionRevision;
    const { lat, lng } = marker.getLngLat();
    return { lat, lng };
  });
  const center = $derived(map.project(anchor));
  const paneSize = $derived.by(() => {
    void projectionRevision;
    const container = map.getContainer();
    return { width: container.clientWidth, height: container.clientHeight };
  });
  const projectedPoint = (bearing: number) =>
    map.project(windCompassRimPoint(anchor.lat, anchor.lng, bearing)).sub(center);
  const rim = $derived(Array.from({ length: 72 }, (_, i) => projectedPoint(i * 5)));
  const rimDistances = $derived(rim.map((point) => point.mag()));
  const compassScale = $derived.by(() => {
    const geographicRadius = Math.max(...rimDistances);
    if (geographicRadius <= 0) return 1;
    const minimumDiameterFraction = $isMobile ? 0.6 : 0.33;
    const minimumRadius = (Math.min(paneSize.width, paneSize.height) * minimumDiameterFraction) / 2;
    return Math.max(1, minimumRadius / geographicRadius);
  });
  const outline = $derived(rim.map((point) => `${point.x * compassScale},${point.y * compassScale}`).join(' '));
  const labelScale = $derived(Math.min(1, Math.max(0.001, (Math.min(...rimDistances) * compassScale) / 136)));
  const arrows = $derived.by(() => {
    return rows
      .flatMap((row) => {
        if (row.bearing === null) return [];
        // Map compass tips mark the wind's source bearing on the rim.
        const point = projectedPoint(row.bearing);
        return [
          {
            ...row,
            bearing: row.bearing,
            rotation: (Math.atan2(point.y, point.x) * 180) / Math.PI,
            radius: point.mag() * compassScale - tip * labelScale,
            color: Number.isFinite(row.speed) ? windColorScale(row.speed) : '#94a3b8',
            gustColor: Number.isFinite(row.gust) ? windColorScale(row.gust) : '#94a3b8',
          },
        ];
      })
      .sort((a, b) => Number(a.id === highlighted) - Number(b.id === highlighted));
  });
  const inspectedModels = $derived(
    rows
      .filter(({ id, bearing }) => bearing !== null && (hovered.length ? hovered.includes(id) : id === focused))
      .map(({ id }) => id)
  );
  const inspected = $derived(arrows.filter(({ id }) => inspectedModels.includes(id)));
  $effect(() => {
    onInspectModels(inspectedModels);
  });
  onDestroy(() => onInspectModels([]));
  const tooltipWidth = $derived(Math.min(276, Math.max(0, paneSize.width - 16)));
  const tooltipHeight = $derived(40 + inspected.length * 18);
  const tooltipX = $derived(
    Math.min(Math.max(-tooltipWidth / 2, 8 - center.x), paneSize.width - center.x - tooltipWidth - 8)
  );
  const tooltipY = $derived(
    Math.max(
      8 - center.y,
      center.y >= tooltipHeight + 12 ? -tooltipHeight - 8 : Math.min(14, paneSize.height - center.y - tooltipHeight - 8)
    )
  );
  const value = (n: number) => (Number.isFinite(n) ? Math.round(windSpeed(n, $units)) : '–');
</script>

<svg
  bind:this={svg}
  viewBox="-174 -174 348 348"
  class="size-full overflow-visible"
  role="group"
  aria-label={`Model wind at ${levelLabel}${showGusts ? ' with preceding-hour gusts' : ''} in ${$units.wind}`}
  onpointerleave={() => (hovered = [])}
>
  {#if arrows.length}
    <polygon points={outline} fill="none" stroke="#475569" stroke-opacity=".28" stroke-width={2 * labelScale} />
    <polygon points={outline} fill="none" stroke="white" stroke-opacity=".85" stroke-width={labelScale} />
  {/if}
  {#each arrows as arrow (arrow.id)}
    <path
      transform={`rotate(${arrow.rotation})`}
      d={`M0 0H${Math.max(0, arrow.radius + tail * labelScale)}`}
      stroke={arrow.color}
      stroke-width={(active.includes(arrow.id) ? 2 : 1.2) * labelScale}
      opacity={!active.includes(null) && !active.includes(arrow.id) ? 0.5 : 1}
    />
  {/each}
  {#each arrows as arrow (arrow.id)}
    {@const flip = Math.cos((arrow.rotation * Math.PI) / 180) < 0}
    {@const shape = `M${tail} -6H12L20 0L12 6H${tail}Z`}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard focus exposes the same forecast details as hover.) -->
    <g
      transform={`rotate(${arrow.rotation}) translate(${arrow.radius} 0) scale(${labelScale})`}
      role="group"
      tabindex="0"
      aria-label={`${arrow.name}, wind ${value(arrow.speed)} ${$units.wind}${showGusts ? `, gust ${value(arrow.gust)} ${$units.wind}` : ''}, from ${Math.round(arrow.bearing) % 360} degrees`}
      class="pointer-events-auto cursor-help outline-none"
      opacity={!active.includes(null) && !active.includes(arrow.id) ? 0.7 : 1}
      data-wind-compass-label={arrow.id}
      onpointerenter={inspectPointer}
      onpointermove={inspectPointer}
      onpointerleave={(event) => {
        if (!(event.relatedTarget instanceof Element && event.relatedTarget.closest('[data-wind-compass-label]'))) {
          hovered = [];
        }
      }}
      onfocus={() => (focused = arrow.id)}
      onblur={() => (focused = null)}
    >
      <path d={shape} fill="none" stroke="transparent" stroke-width={Math.max(0, 18 / labelScale - 12)} />
      <path d={`M${tail} -6H-20V6H${tail}Z`} fill={`color-mix(in srgb, ${arrow.color} 38%, white)`} />
      <path d="M-20 -6H12L20 0L12 6H-20Z" fill={`color-mix(in srgb, ${arrow.color} 58%, white)`} />
      <path d="M12 -6L20 0L12 6Z" fill={arrow.color} />
      <path
        d={shape}
        fill="none"
        stroke={showGusts ? arrow.gustColor : arrow.color}
        stroke-width={active.includes(arrow.id) ? 2 : 1.3}
      />
      <text
        x="-64"
        y="0"
        dominant-baseline="central"
        transform={flip ? 'rotate(180 -64 0)' : undefined}
        fill="#334155"
        text-anchor="middle"
        font-size="8.6"
        font-weight="650"
      >
        {arrow.name}
      </text>
      <text
        x="-4"
        y="0"
        dominant-baseline="central"
        transform={flip ? 'rotate(180 -4 0)' : undefined}
        fill="#152334"
        text-anchor="middle"
        font-size="9"
        font-weight="750">{value(arrow.speed)}{showGusts ? ` / ${value(arrow.gust)}` : ''}</text
      >
    </g>
  {/each}
  {#if arrows.length}<circle r={3.8 * labelScale} fill="#334155" stroke="white" stroke-width="1.6" />{/if}
  {#if inspected.length}
    <foreignObject x={tooltipX} y={tooltipY} width={tooltipWidth} height={tooltipHeight} class="pointer-events-none">
      <div
        aria-hidden="true"
        class="rounded-xl border border-white/20 bg-slate-900/95 px-3 py-2 text-xs text-white shadow-lg"
      >
        <div class="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-2 text-[10px] tabular-nums">
          <span class="text-slate-300">Model</span>
          <span class="text-right text-slate-300">From</span>
          <span class="text-right text-slate-300">{showGusts ? 'Wind / gust' : 'Wind'} · {$units.wind}</span>
          {#each inspected as arrow (arrow.id)}
            <span class="truncate leading-[18px] font-semibold">{arrow.name}</span>
            <span class="text-right leading-[18px]"
              >{windDirectionLabel(arrow.bearing)} {Math.round(arrow.bearing) % 360}°</span
            >
            <span class="text-right leading-[18px]"
              >{value(arrow.speed)}{showGusts ? ` / ${value(arrow.gust)}` : ''}</span
            >
          {/each}
        </div>
      </div>
    </foreignObject>
  {/if}
</svg>
