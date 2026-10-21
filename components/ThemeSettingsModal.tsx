import React, { useState, useEffect } from 'react';
import { 
  themeService, 
  THEME_MODES, 
  ACCENT_PRESETS, 
  ThemeMode, 
  AccentPreset, 
  VisualizerStyle,
  ThemeConfig 
} from '../services/themeService';
import { colorWithAlpha } from '../services/colorUtils';
import Visualizer from './Visualizer';

interface ThemeSettingsModalProps {
  onClose: () => void;
  currentSongDominantColor: string;
}

const ThemeSettingsModal: React.FC<ThemeSettingsModalProps> = ({
  onClose,
  currentSongDominantColor,
}) => {
  const [config, setConfig] = useState<ThemeConfig>(() => themeService.getConfig());
  const [effectiveAccent, setEffectiveAccent] = useState<string>(() => themeService.getEffectiveAccent());

  useEffect(() => {
    return themeService.subscribe((newConfig, newAccent) => {
      setConfig(newConfig);
      setEffectiveAccent(newAccent);
    });
  }, []);

  const handleSelectMode = (mode: ThemeMode) => {
    themeService.setMode(mode);
  };

  const handleSelectAccent = (accent: AccentPreset) => {
    themeService.setAccent(accent);
  };

  const handleSelectVisualizer = (style: VisualizerStyle) => {
    themeService.setVisualizerStyle(style);
  };

  const isLightMode = config.mode === 'crisp_white';

  // Strict color assignments for light vs dark mode to prevent invisible white-on-white text
  const modalBg = isLightMode ? '!bg-white !text-zinc-900 border-zinc-300' : 'bg-[var(--color-surface)] text-white border-white/10';
  const textPrimary = isLightMode ? '!text-zinc-900 font-bold' : 'text-white font-bold';
  const textSecondary = isLightMode ? '!text-zinc-600' : 'text-white/60';
  const textMuted = isLightMode ? '!text-zinc-500' : 'text-white/45';
  const cardBg = isLightMode ? '!bg-zinc-100 border-zinc-300 hover:!bg-zinc-200' : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]';
  const closeBtnBg = isLightMode ? '!bg-zinc-200 hover:!bg-zinc-300 !text-zinc-800' : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white';

  return (
    <div 
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/75 p-2 sm:p-4 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] backdrop-blur-2xl animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div 
        className={`relative w-full max-w-xl max-h-[92dvh] overflow-y-auto no-scrollbar rounded-[28px] border p-4 sm:p-6 shadow-2xl transition-all duration-300 animate-in slide-in-from-bottom-4 ${modalBg}`}
        style={{ borderColor: colorWithAlpha(effectiveAccent, 0.3) }}
        onClick={e => e.stopPropagation()}
      >
        {/* Ambient Top Glow */}
        <div 
          className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-36 rounded-full blur-[90px] pointer-events-none opacity-40 transition-colors duration-500" 
          style={{ backgroundColor: effectiveAccent }}
        />

        {/* Header */}
        <div className={`relative z-10 flex items-center justify-between pb-3 border-b ${isLightMode ? 'border-zinc-200' : 'border-white/10'}`}>
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg border"
              style={{ backgroundColor: colorWithAlpha(effectiveAccent, 0.15), borderColor: colorWithAlpha(effectiveAccent, 0.4), color: isLightMode ? effectiveAccent : '#fff' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4 4 4 0 014-4 4 4 0 014 4 4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
            </div>
            <div>
              <h2 className={`text-base sm:text-lg tracking-tight ${textPrimary}`}>Theme & Visual Experience</h2>
              <p className={`text-[11px] ${textSecondary}`}>Personalize themes, accents, and visualizers</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className={`p-2 rounded-full transition-all active:scale-90 ${closeBtnBg}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Live Preview Card */}
        <div className={`relative mt-4 p-3.5 rounded-2xl border shadow-inner overflow-hidden flex items-center gap-3 ${isLightMode ? '!bg-zinc-100 border-zinc-300' : 'bg-black/40 border-white/25'}`} style={{ borderColor: colorWithAlpha(effectiveAccent, 0.25) }}>
          <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border relative" style={{ borderColor: colorWithAlpha(effectiveAccent, 0.4) }}>
            <img src="https://picsum.photos/seed/zenisai_preview/200/200" alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/25" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[9px] font-bold uppercase tracking-wider block leading-none mb-0.5" style={{ color: effectiveAccent }}>Live Style Preview</span>
            <p className={`text-xs truncate ${textPrimary}`}>Soundtrack of the Universe</p>
            <div className="h-5 w-full mt-1">
              <Visualizer analyser={null} color={effectiveAccent} isPlaying={true} style={config.visualizerStyle} />
            </div>
          </div>
        </div>

        {/* Section 1: Themes */}
        <div className="mt-4 space-y-2">
          <label className={`text-[11px] font-black uppercase tracking-wider block ${textSecondary}`}>Theme Mode</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(Object.entries(THEME_MODES) as [ThemeMode, { name: string; desc: string; bg: string; surface: string }][]).map(([modeKey, info]) => {
              const isSelected = config.mode === modeKey;
              return (
                <button
                  key={modeKey}
                  onClick={() => handleSelectMode(modeKey)}
                  className={`p-3 rounded-2xl text-left border transition-all duration-200 relative overflow-hidden active:scale-95 ${
                    isSelected 
                      ? 'border-transparent shadow-lg ring-2' 
                      : cardBg
                  }`}
                  style={isSelected ? { 
                    backgroundColor: isLightMode ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)', 
                    borderColor: effectiveAccent,
                    boxShadow: `0 4px 20px ${colorWithAlpha(effectiveAccent, 0.25)}` 
                  } : {}}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs truncate ${textPrimary}`}>{info.name}</span>
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: effectiveAccent }} />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <div className="w-4 h-4 rounded-full border border-zinc-400 shadow-sm" style={{ backgroundColor: info.bg }} />
                    <div className="w-4 h-4 rounded-full border border-zinc-400 shadow-sm" style={{ backgroundColor: info.surface }} />
                  </div>
                  <p className={`text-[10px] mt-1.5 line-clamp-1 ${textMuted}`}>{info.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 2: Accent Colors */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <label className={`text-[11px] font-black uppercase tracking-wider ${textSecondary}`}>Accent Highlight Color</label>
            <span className={`text-[10px] font-semibold ${textMuted}`}>{ACCENT_PRESETS[config.accent]?.name}</span>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {(Object.entries(ACCENT_PRESETS) as [AccentPreset, { name: string; hex: string }][]).map(([key, item]) => {
              const isSelected = config.accent === key;
              const displayColor = key === 'dynamic' ? currentSongDominantColor : item.hex;
              return (
                <button
                  key={key}
                  onClick={() => handleSelectAccent(key)}
                  className={`p-2.5 rounded-2xl flex flex-col items-center gap-1.5 border transition-all active:scale-90 ${
                    isSelected ? 'ring-2 ring-zinc-500 scale-105 shadow-lg' : cardBg
                  }`}
                  style={isSelected ? { borderColor: displayColor } : {}}
                  title={item.name}
                >
                  <div 
                    className="w-7 h-7 rounded-full shadow-md flex items-center justify-center transition-transform"
                    style={{ backgroundColor: displayColor }}
                  >
                    {key === 'dynamic' && (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    )}
                    {isSelected && key !== 'dynamic' && (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    )}
                  </div>
                  <span className={`text-[9px] font-bold truncate w-full text-center ${textSecondary}`}>
                    {key === 'dynamic' ? 'Dynamic' : item.name.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 3: Visualizer Styles */}
        <div className="mt-4 space-y-2">
          <label className={`text-[11px] font-black uppercase tracking-wider block ${textSecondary}`}>Audio Visualizer Engine</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'bars', name: 'Spectrum Bars', desc: 'Punchy EQ bands' },
              { id: 'wave', name: 'Smooth Waveform', desc: 'Sine curves' },
              { id: 'pulse', name: 'Radial Pulse', desc: 'Concentric ring' },
            ].map(vis => {
              const isSelected = config.visualizerStyle === vis.id;
              return (
                <button
                  key={vis.id}
                  onClick={() => handleSelectVisualizer(vis.id as VisualizerStyle)}
                  className={`p-3 rounded-2xl border text-left transition-all active:scale-95 ${
                    isSelected 
                      ? 'border-transparent shadow-lg ring-1' 
                      : cardBg
                  }`}
                  style={isSelected ? { 
                    backgroundColor: isLightMode ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)', 
                    borderColor: effectiveAccent,
                    boxShadow: `0 4px 15px ${colorWithAlpha(effectiveAccent, 0.25)}` 
                  } : {}}
                >
                  <span className={`text-xs block ${textPrimary}`}>{vis.name}</span>
                  <span className={`text-[10px] block mt-0.5 ${textMuted}`}>{vis.desc}</span>
                  <div className="h-6 w-full mt-2 rounded-lg bg-black/30 p-1">
                    <Visualizer analyser={null} color={effectiveAccent} isPlaying={true} style={vis.id as VisualizerStyle} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Apply Button */}
        <div className="mt-5 pt-2">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl font-bold text-xs sm:text-sm text-white shadow-xl hover:brightness-110 active:scale-98 transition-all"
            style={{ backgroundColor: effectiveAccent }}
          >
            Done & Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThemeSettingsModal;
