export function generateEmojiIcon(emoji: string = '🌤️') {
    const emojiToDataURL = (size: number) => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        if (!ctx) return '';

        ctx.font = `${size * 0.9}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(emoji, size / 2, size / 2);

        return canvas.toDataURL('image/png');
    };

    // Generate different sizes for PWA
    const sizes = [16, 32, 72, 96, 128, 144, 152, 192, 384, 512];
    const icons = sizes.map(size => ({
        src: emojiToDataURL(size),
        sizes: `${size}x${size}`,
        type: 'image/png'
    }));

    return icons;
}
