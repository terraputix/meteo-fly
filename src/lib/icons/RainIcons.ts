const rainDrop = {
    draw(context: CanvasPath, size: number, offsetX: number, offsetY: number) {
        const s = Math.sqrt(size) * 0.6824;
        const t = s / 2;
        const u = (s * Math.sqrt(3)) / 2;

        // Move to the top of the raindrop with offset
        context.moveTo(offsetX, offsetY - s);

        // Draw the left curve of the raindrop with offset
        context.bezierCurveTo(offsetX - u, offsetY - t, offsetX - u, offsetY + t, offsetX, offsetY + s);

        // Draw the right curve of the raindrop with offset
        context.bezierCurveTo(offsetX + u, offsetY + t, offsetX + u, offsetY - t, offsetX, offsetY - s);

        context.closePath();
    }
};

const rainSymbols = {
    light: {
        draw(context: CanvasPath, size: number) {
            // Single raindrop
            rainDrop.draw(context, size, 0, 0);
        }
    },
    moderate: {
        draw(context: CanvasPath, size: number) {
            // Two raindrops
            rainDrop.draw(context, size, 0, -0.15 * size);
            rainDrop.draw(context, size, 0, 0);
        }
    },
    heavy: {
        draw(context: CanvasPath, size: number) {
            // Three raindrops
            rainDrop.draw(context, size, 0, -0.3 * size);
            rainDrop.draw(context, size, 0, -0.15 * size);
            rainDrop.draw(context, size, 0, 0);
        }
    }
};

export function getRainSymbol(rainAmount: number) {
    if (rainAmount > 4) return rainSymbols.heavy;
    if (rainAmount > 1) return rainSymbols.moderate;
    return rainSymbols.light;
}
