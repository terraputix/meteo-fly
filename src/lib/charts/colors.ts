export function getWindColor(speed: number): string {
    if (speed < 5) return '#00B000';      // Green
    if (speed < 7.5) return '#66B000';    // Light green
    if (speed < 10) return '#83B000';     // Yellow-green
    if (speed < 12.5) return '#A0B000';   // Light yellow
    if (speed < 15) return '#B3B000';     // Yellow
    if (speed < 17.5) return '#B39000';   // Yellow-orange
    if (speed < 20) return '#B37000';     // Orange
    if (speed < 22.5) return '#B35000';   // Dark orange
    if (speed < 25) return '#C00000';     // Red
    if (speed < 27.5) return '#A00000';   // Dark red
    return '#800000';                     // Very dark red
}
