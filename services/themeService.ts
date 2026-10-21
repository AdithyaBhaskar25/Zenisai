import { colorWithAlpha } from './colorUtils';

export type ThemeMode = 'dark' | 'oled' | 'light' | 'neon' | 'ambient' | 'elegant';
export type AccentPreset = 'dynamic' | 'blue' | 'cyan' | 'emerald' | 'amber' | 'violet' | 'crimson' | 'rose';
export type VisualizerStyle = 'bars' | 'wave' | 'pulse';

export interface ThemeConfig {
  mode: ThemeMode;
  accent: AccentPreset;
  visualizerStyle: VisualizerStyle;
  animationsEnabled: boolean;
}

export const ACCENT_PRESETS: Record<AccentPreset, { name: string; hex: string }> = {
  dynamic: { name: 'Dynamic (Song Art)', hex: '#3b82f6' },
  blue: { name: 'Ocean Blue', hex: '#3b82f6' },
  cyan: { name: 'Neon Cyan', hex: '#06b6d4' },
  emerald: { name: 'Emerald Jade', hex: '#10b981' },
  amber: { name: 'Sunset Amber', hex: '#f59e0b' },
  violet: { name: 'Electric Violet', hex: '#8b5cf6' },
  crimson: { name: 'Crimson Flame', hex: '#ef4444' },
  rose: { name: 'Rose Quartz', hex: '#ec4899' },
};

export const THEME_MODES: Record<ThemeMode, { name: string; desc: string; bg: string; surface: string }> = {
  dark: {
    name: 'Midnight Dark',
    desc: 'Deep obsidian and deep navy (Default)',
    bg: '#030711',
    surface: '#0b1220'
  },
  oled: {
    name: 'Pitch Black (AMOLED)',
    desc: 'Pure #000000 for battery saving & OLED displays',
    bg: '#000000',
    surface: '#070707'
  },
  light: {
    name: 'Modern Crisp Light',
    desc: 'Pure frosted white surfaces & sharp black typography',
    bg: '#ffffff',
    surface: '#ffffff'
  },
  neon: {
    name: 'Cyberpunk Neon',
    desc: 'Deep ultraviolet obsidian with electric glow',
    bg: '#080214',
    surface: '#140a24'
  },
  ambient: {
    name: 'Ambient Immersive',
    desc: 'Rich atmospheric gradient sync with track vibe',
    bg: '#050714',
    surface: '#0d1326'
  },
  elegant: {
    name: 'Warm Champagne',
    desc: 'Luxurious warm titanium with gold hues',
    bg: '#0e0c0a',
    surface: '#1b1714'
  }
};

const STORAGE_KEY = 'zenisai_theme_config_v2';

class ThemeService {
  private config: ThemeConfig = {
    mode: 'dark',
    accent: 'dynamic',
    visualizerStyle: 'bars',
    animationsEnabled: true,
  };

  private currentSongDominantColor: string = '#3b82f6';
  private listeners: Array<(c: ThemeConfig, effectiveAccent: string) => void> = [];

  constructor() {
    this.load();
  }

  private load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.config = { ...this.config, ...JSON.parse(saved) };
      }
    } catch {}
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
      this.applyToDOM();
      this.notify();
    } catch {}
  }

  public subscribe(cb: (c: ThemeConfig, effectiveAccent: string) => void): () => void {
    this.listeners.push(cb);
    cb(this.getConfig(), this.getEffectiveAccent());
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  private notify() {
    const conf = this.getConfig();
    const eff = this.getEffectiveAccent();
    this.listeners.forEach(cb => {
      try { cb(conf, eff); } catch {}
    });
  }

  public getConfig(): ThemeConfig {
    return { ...this.config };
  }

  public getEffectiveAccent(): string {
    if (this.config.accent === 'dynamic') {
      return this.currentSongDominantColor || '#3b82f6';
    }
    return ACCENT_PRESETS[this.config.accent]?.hex || '#3b82f6';
  }

  public setSongDominantColor(hex: string) {
    if (!hex) return;
    this.currentSongDominantColor = hex;
    this.applyToDOM();
    if (this.config.accent === 'dynamic' || this.config.mode === 'ambient') {
      this.notify();
    }
  }

  public setMode(mode: ThemeMode) {
    this.config.mode = mode;
    this.save();
  }

  public setAccent(accent: AccentPreset) {
    this.config.accent = accent;
    this.save();
  }

  public setVisualizerStyle(style: VisualizerStyle) {
    this.config.visualizerStyle = style;
    this.save();
  }

  public setAnimationsEnabled(enabled: boolean) {
    this.config.animationsEnabled = enabled;
    this.save();
  }

  public applyToDOM() {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const body = document.body;
    const effAccent = this.getEffectiveAccent();
    const modeConfig = THEME_MODES[this.config.mode] || THEME_MODES.dark;
    const isLight = this.config.mode === 'light';

    let bg = modeConfig.bg;
    let surface = modeConfig.surface;

    if (this.config.mode === 'ambient') {
      bg = `color-mix(in srgb, #02040a 78%, ${effAccent} 22%)`;
      surface = `color-mix(in srgb, #080d1a 75%, ${effAccent} 25%)`;
    }

    // Set CSS custom properties with safe values
    root.style.setProperty('--color-primary', effAccent);
    root.style.setProperty('--color-bg', bg);
    root.style.setProperty('--color-surface', surface);
    root.style.setProperty('--color-glow', colorWithAlpha(effAccent, 0.35));
    root.style.setProperty('--color-tint', colorWithAlpha(effAccent, 0.12));
    root.style.setProperty('--color-text', isLight ? '#000000' : '#f8fafc');
    root.style.setProperty('--color-text-dim', isLight ? '#1e293b' : 'rgba(255, 255, 255, 0.7)');
    root.style.setProperty('--color-text-muted', isLight ? '#334155' : 'rgba(255, 255, 255, 0.45)');
    root.style.setProperty('--color-border', isLight ? 'rgba(15, 23, 42, 0.14)' : 'rgba(255, 255, 255, 0.1)');
    root.style.setProperty('--color-card-bg', isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.04)');

    // Toggle body classes
    body.classList.remove('theme-dark', 'theme-oled', 'theme-light', 'theme-neon', 'theme-ambient', 'theme-elegant');
    body.classList.add(`theme-${this.config.mode}`);

    if (isLight) {
      body.classList.remove('text-white');
      body.classList.add('text-black');
    } else {
      body.classList.remove('text-black');
      body.classList.add('text-white');
    }

    // Sync meta theme-color dynamically for mobile status/notification bars
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      let resolvedThemeColor = bg;
      if (isLight) {
        resolvedThemeColor = '#ffffff';
      } else if (this.config.mode === 'oled') {
        resolvedThemeColor = '#000000';
      } else if (this.config.mode === 'ambient') {
        // Use the live dynamic accent/song color directly for the ambient status bar tint
        resolvedThemeColor = effAccent;
      } else {
        resolvedThemeColor = bg;
      }
      metaThemeColor.setAttribute('content', resolvedThemeColor);
    }
  }
}

export const themeService = new ThemeService();
