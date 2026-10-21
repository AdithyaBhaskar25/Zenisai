/**
 * Safe Color Utilities for Canvas Gradients, CSS Variables, and DOM styling.
 * Prevents Canvas addColorStop syntax errors and ensures valid color strings.
 */

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Robustly parses any valid color string (hex, rgb, rgba, hsl, hsla) into RGBA components.
 * Falls back to default vibrant blue if unparseable.
 */
export function parseColor(color: string): RGBA {
  if (!color || typeof color !== 'string') {
    return { r: 59, g: 130, b: 246, a: 1 };
  }

  const c = color.trim();

  // 1. Handle rgb(r, g, b) or rgba(r, g, b, a)
  const rgbMatch = c.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (rgbMatch) {
    return {
      r: Math.max(0, Math.min(255, parseInt(rgbMatch[1], 10))),
      g: Math.max(0, Math.min(255, parseInt(rgbMatch[2], 10))),
      b: Math.max(0, Math.min(255, parseInt(rgbMatch[3], 10))),
      a: rgbMatch[4] !== undefined ? Math.max(0, Math.min(1, parseFloat(rgbMatch[4]))) : 1,
    };
  }

  // 2. Handle hex #rgb, #rgba, #rrggbb, #rrggbbaa
  if (c.startsWith('#')) {
    let hex = c.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      hex = hex.split('').map(ch => ch + ch).join('');
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.substring(0, 2), 16) || 0;
      const g = parseInt(hex.substring(2, 4), 16) || 0;
      const b = parseInt(hex.substring(4, 6), 16) || 0;
      const a = hex.length >= 8 ? parseInt(hex.substring(6, 8), 16) / 255 : 1;
      return { r, g, b, a: Math.max(0, Math.min(1, Math.round(a * 100) / 100)) };
    }
  }

  // 3. Handle hsl(h, s%, l%) or hsla(h, s%, l%, a)
  const hslMatch = c.match(/^hsla?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (hslMatch) {
    const h = parseFloat(hslMatch[1]) / 360;
    const s = parseFloat(hslMatch[2]) / 100;
    const l = parseFloat(hslMatch[3]) / 100;
    const a = hslMatch[4] !== undefined ? Math.max(0, Math.min(1, parseFloat(hslMatch[4]))) : 1;

    let r: number, g: number, b: number;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
      a
    };
  }

  // Fallback for safety
  return { r: 59, g: 130, b: 246, a: 1 };
}

/**
 * Returns a guaranteed valid CSS `rgba(r, g, b, alpha)` string.
 * This is safe to pass to canvas `ctx.createLinearGradient().addColorStop()`,
 * inline styles, and CSS custom properties without throwing SyntaxErrors.
 */
export function colorWithAlpha(color: string, alpha: number): string {
  const { r, g, b } = parseColor(color);
  const clampedAlpha = Math.max(0, Math.min(1, Math.round(alpha * 100) / 100));
  return `rgba(${r}, ${g}, ${b}, ${clampedAlpha})`;
}

/**
 * Determines whether a color is bright/light (relative luminance > 0.55).
 * Useful for adjusting text contrast against dynamic backgrounds.
 */
export function isLightColor(color: string): boolean {
  const { r, g, b } = parseColor(color);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55;
}

/**
 * Formats a color as hex #rrggbb
 */
export function toHex(color: string): string {
  const { r, g, b } = parseColor(color);
  const toH = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toH(r)}${toH(g)}${toH(b)}`;
}
