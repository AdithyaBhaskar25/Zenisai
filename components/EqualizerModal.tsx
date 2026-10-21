import React, { useState, useEffect, useRef } from 'react';
import { equalizerService, EQ_BANDS, EQ_PRESETS, EqualizerSettings } from '../services/equalizerService';
import { themeService } from '../services/themeService';
import { colorWithAlpha } from '../services/colorUtils';

interface EqualizerModalProps {
  onClose: () => void;
  dominantColor: string;
  analyser: AnalyserNode | null;
  isPlaying: boolean;
}

const EqualizerModal: React.FC<EqualizerModalProps> = ({
  onClose,
  dominantColor,
  analyser,
  isPlaying,
}) => {
  const [settings, setSettings] = useState<EqualizerSettings>(() => equalizerService.getSettings());
  const [themeConfig, setThemeConfig] = useState(() => themeService.getConfig());
  const curveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const activeColor = dominantColor || '#3b82f6';
  const isLight = themeConfig.mode === 'light' || themeConfig.mode === 'crisp_white';

  useEffect(() => {
    return equalizerService.subscribe(newSettings => {
      setSettings(newSettings);
    });
  }, []);

  useEffect(() => {
    return themeService.subscribe(newConfig => {
      setThemeConfig(newConfig);
    });
  }, []);

  // Draw real-time EQ response curve + audio FFT spectrum
  useEffect(() => {
    if (!curveCanvasRef.current) return;
    const canvas = curveCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const bufferLength = analyser ? analyser.frequencyBinCount : 32;
    const dataArray = new Uint8Array(bufferLength);
    let animId: number;

    const draw = () => {
      animId = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, rect.width, rect.height);

      const w = rect.width;
      const h = rect.height;
      const midY = h / 2;

      // Draw faint grid lines (-12dB, 0dB, +12dB)
      ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      // +12dB line
      ctx.beginPath();
      ctx.moveTo(0, h * 0.15);
      ctx.lineTo(w, h * 0.15);
      ctx.stroke();

      // 0dB center line
      ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.14)' : 'rgba(255, 255, 255, 0.18)';
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(w, midY);
      ctx.stroke();

      // -12dB line
      ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.85);
      ctx.lineTo(w, h * 0.85);
      ctx.stroke();

      ctx.setLineDash([]);

      // Draw live spectrum FFT bars in the background if audio is active
      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(dataArray);
        const barCount = 28;
        const barWidth = (w / barCount) * 0.7;
        const gap = (w - barCount * barWidth) / (barCount - 1);
        let barX = 0;

        ctx.fillStyle = colorWithAlpha(activeColor, isLight ? 0.2 : 0.15);
        for (let i = 0; i < barCount; i++) {
          const val = dataArray[i];
          const barH = (val / 255) * (h * 0.8);
          ctx.beginPath();
          ctx.roundRect(barX, h - barH, barWidth, barH, 3);
          ctx.fill();
          barX += barWidth + gap;
        }
      }

      // Draw Equalizer Frequency Response Curve
      const bands = settings.enabled ? settings.bands : [0, 0, 0, 0, 0];
      const points: { x: number; y: number }[] = [];

      const startDb = bands[0] + (settings.bassBoost / 100) * 8;
      const startY = midY - (startDb / 12) * (h * 0.35);
      points.push({ x: 0, y: Math.max(8, Math.min(h - 8, startY)) });

      bands.forEach((gain, index) => {
        const x = (w / (bands.length - 1)) * index;
        const boost = index === 0 ? (settings.bassBoost / 100) * 8 : 0;
        const effectiveGain = gain + boost;
        const y = midY - (effectiveGain / 12) * (h * 0.35);
        points.push({ x, y: Math.max(8, Math.min(h - 8, y)) });
      });

      const lastY = midY - (bands[bands.length - 1] / 12) * (h * 0.35);
      points.push({ x: w, y: Math.max(8, Math.min(h - 8, lastY)) });

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);

      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const cpX = (p0.x + p1.x) / 2;
        ctx.bezierCurveTo(cpX, p0.y, cpX, p1.y, p1.x, p1.y);
      }

      ctx.strokeStyle = settings.enabled ? activeColor : (isLight ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.4)');
      ctx.lineWidth = 3;
      ctx.shadowBlur = settings.enabled ? 16 : 0;
      ctx.shadowColor = activeColor;
      ctx.stroke();

      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      const fillGrad = ctx.createLinearGradient(0, 0, 0, h);
      fillGrad.addColorStop(0, settings.enabled ? colorWithAlpha(activeColor, 0.28) : (isLight ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.05)'));
      fillGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = fillGrad;
      ctx.fill();

      bands.forEach((gain, index) => {
        const x = (w / (bands.length - 1)) * index;
        const boost = index === 0 ? (settings.bassBoost / 100) * 8 : 0;
        const effectiveGain = gain + boost;
        const y = midY - (effectiveGain / 12) * (h * 0.35);

        ctx.beginPath();
        ctx.arc(x, Math.max(8, Math.min(h - 8, y)), 5, 0, Math.PI * 2);
        ctx.fillStyle = isLight ? '#000000' : '#ffffff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = activeColor;
        ctx.fill();
      });
    };

    draw();
    return () => cancelAnimationFrame(animId);
  }, [settings, analyser, isPlaying, activeColor, isLight]);

  // Color theme classes
  const modalBg = isLight ? '!bg-white !text-zinc-900 border-zinc-300' : 'bg-[var(--color-surface)] text-white border-white/10';
  const textPrimary = isLight ? '!text-zinc-900 font-bold' : 'text-white font-bold';
  const textSecondary = isLight ? '!text-zinc-600' : 'text-white/60';
  const textMuted = isLight ? '!text-zinc-500' : 'text-white/45';
  const containerBg = isLight ? '!bg-zinc-100 border-zinc-200' : 'bg-white/[0.03] border-white/10';
  const closeBtnBg = isLight ? '!bg-zinc-200 hover:!bg-zinc-300 !text-zinc-700' : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white';

  return (
    <div 
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/75 p-2 sm:p-4 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] backdrop-blur-2xl animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div 
        className={`relative w-full max-w-lg max-h-[92dvh] overflow-y-auto no-scrollbar rounded-[28px] border p-4 sm:p-6 shadow-2xl transition-all duration-300 animate-in slide-in-from-bottom-4 ${modalBg}`}
        style={{ borderColor: colorWithAlpha(activeColor, 0.3) }}
        onClick={e => e.stopPropagation()}
      >
        {/* Ambient Top Glow */}
        <div 
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-36 rounded-full blur-[90px] pointer-events-none opacity-40 transition-colors duration-500" 
          style={{ backgroundColor: activeColor }}
        />

        {/* Header */}
        <div className={`relative z-10 flex items-center justify-between pb-3 border-b ${isLight ? 'border-zinc-200' : 'border-white/10'}`}>
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg border"
              style={{ backgroundColor: colorWithAlpha(activeColor, 0.15), borderColor: colorWithAlpha(activeColor, 0.4), color: isLight ? activeColor : '#fff' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <div>
              <h2 className={`text-base sm:text-lg tracking-tight flex items-center gap-2 ${textPrimary}`}>
                Equalizer & Audio FX
                {settings.enabled && (
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: activeColor }} />
                )}
              </h2>
              <p className={`text-[11px] ${textSecondary}`}>High-fidelity 5-band sound stage</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Master Toggle */}
            <button
              onClick={() => equalizerService.setEnabled(!settings.enabled)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 active:scale-95 ${
                settings.enabled
                  ? 'text-white shadow-lg'
                  : isLight ? 'bg-zinc-200 text-zinc-600 border-zinc-300' : 'bg-white/5 text-white/40 border-white/10'
              }`}
              style={settings.enabled ? { backgroundColor: activeColor, borderColor: activeColor } : {}}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${settings.enabled ? 'bg-white' : 'bg-current'}`} />
              {settings.enabled ? 'ON' : 'BYPASS'}
            </button>

            {/* Close Button */}
            <button 
              onClick={onClose}
              className={`p-2 rounded-full transition-all active:scale-90 ${closeBtnBg}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Real-time Frequency Response Canvas */}
        <div className={`relative mt-3 h-28 sm:h-32 w-full rounded-2xl border overflow-hidden shadow-inner ${isLight ? 'bg-zinc-100 border-zinc-300' : 'bg-black/40 border-white/10'}`}>
          <canvas ref={curveCanvasRef} className="w-full h-full" />
          <div className={`absolute top-2 left-3 text-[9px] font-bold uppercase tracking-widest pointer-events-none ${isLight ? 'text-zinc-500' : 'text-white/40'}`}>
            +12 dB
          </div>
          <div className={`absolute top-1/2 -translate-y-1/2 left-3 text-[9px] font-bold uppercase tracking-widest pointer-events-none ${isLight ? 'text-zinc-400' : 'text-white/20'}`}>
            0 dB
          </div>
          <div className={`absolute bottom-2 left-3 text-[9px] font-bold uppercase tracking-widest pointer-events-none ${isLight ? 'text-zinc-500' : 'text-white/40'}`}>
            -12 dB
          </div>
        </div>

        {/* Preset Selector Chips */}
        <div className="mt-3.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider ${textSecondary}`}>Presets</span>
            <button
              onClick={() => equalizerService.resetFlat()}
              className={`text-[10px] font-bold hover:underline transition-colors ${textSecondary}`}
            >
              Reset Flat
            </button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {Object.entries(EQ_PRESETS).map(([key, preset]) => {
              const isActive = settings.preset === key;
              return (
                <button
                  key={key}
                  onClick={() => equalizerService.setPreset(key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border active:scale-95 ${
                    isActive 
                      ? 'text-white border-transparent shadow-md' 
                      : isLight ? 'bg-zinc-100 text-zinc-700 border-zinc-300 hover:bg-zinc-200' : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                  }`}
                  style={isActive ? { backgroundColor: activeColor, boxShadow: `0 4px 15px ${colorWithAlpha(activeColor, 0.35)}` } : {}}
                >
                  {preset.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* 5-Band Vertical Equalizer Sliders with Custom Progress Bar Track */}
        <div className={`mt-4 p-4 rounded-2xl border ${containerBg}`}>
          <div className="grid grid-cols-5 gap-2 sm:gap-4 items-end">
            {EQ_BANDS.map((band, idx) => {
              const val = settings.bands[idx] ?? 0;
              // Normalize value from [-12, 12] to percentage [0, 100] for custom progress track
              const fillPercent = ((val + 12) / 24) * 100;
              
              return (
                <div key={band.frequency} className="flex flex-col items-center gap-2">
                  {/* Gain readout */}
                  <span 
                    className="text-[10px] font-bold tracking-tight transition-colors"
                    style={{ color: val !== 0 && settings.enabled ? activeColor : (isLight ? '#52525b' : 'rgba(255,255,255,0.6)') }}
                  >
                    {val > 0 ? `+${val}` : val} dB
                  </span>

                  {/* Custom Progress Bar Vertical Track */}
                  <div className="relative h-32 sm:h-40 w-3 flex items-center justify-center">
                    {/* Background Bar Track */}
                    <div className={`absolute inset-0 rounded-full overflow-hidden border ${isLight ? 'bg-zinc-200 border-zinc-300' : 'bg-black/60 border-white/15'}`}>
                      {/* Active Gain Progress Fill */}
                      <div 
                        className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-75"
                        style={{ 
                          height: `${fillPercent}%`,
                          backgroundColor: settings.enabled ? activeColor : (isLight ? '#a1a1aa' : 'rgba(255,255,255,0.3)')
                        }}
                      />
                    </div>

                    {/* 0dB center marker line */}
                    <div className="absolute top-1/2 -translate-y-1/2 w-4 h-0.5 bg-current opacity-30 pointer-events-none rounded-full z-10" />

                    {/* Interactive Range Input Overlay */}
                    <input
                      type="range"
                      min="-12"
                      max="12"
                      step="0.5"
                      disabled={!settings.enabled}
                      value={val}
                      onChange={e => equalizerService.setBand(idx, parseFloat(e.target.value))}
                      className="absolute w-32 sm:w-40 h-8 -rotate-90 appearance-none bg-transparent cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed z-20 opacity-0"
                    />
                  </div>

                  {/* Frequency label */}
                  <span className={`text-[10px] font-semibold text-center ${textMuted}`}>
                    {band.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Enhancements: Bass Boost & 3D Virtualizer */}
        <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Bass Boost */}
          <div className={`p-3.5 rounded-2xl border flex flex-col gap-2.5 ${containerBg}`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold flex items-center gap-1.5 ${textPrimary}`}>
                <svg className="w-3.5 h-3.5" style={{ color: activeColor }} fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                Deep Bass Boost
              </span>
              <span className="text-xs font-extrabold" style={{ color: activeColor }}>
                {settings.bassBoost}%
              </span>
            </div>
            
            {/* Custom Progress Track for Bass Boost */}
            <div className={`relative h-2.5 w-full rounded-full overflow-hidden border ${isLight ? 'bg-zinc-200 border-zinc-300' : 'bg-black/60 border-white/15'}`}>
              <div 
                className="absolute top-0 bottom-0 left-0 rounded-full transition-all duration-75"
                style={{ 
                  width: `${settings.bassBoost}%`,
                  backgroundColor: settings.enabled ? activeColor : (isLight ? '#a1a1aa' : 'rgba(255,255,255,0.3)')
                }}
              />
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                disabled={!settings.enabled}
                value={settings.bassBoost}
                onChange={e => equalizerService.setBassBoost(parseInt(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* 3D Spatial Virtualizer */}
          <div className={`p-3.5 rounded-2xl border flex items-center justify-between ${containerBg}`}>
            <div>
              <span className={`text-xs font-bold block ${textPrimary}`}>3D Spatializer</span>
              <span className={`text-[10px] ${textMuted}`}>Surround acoustic depth</span>
            </div>
            <button
              onClick={() => equalizerService.setVirtualizer(!settings.virtualizer)}
              disabled={!settings.enabled}
              className={`w-12 h-6 rounded-full p-0.5 transition-colors duration-200 border disabled:opacity-30 ${
                settings.virtualizer && settings.enabled ? 'border-transparent' : (isLight ? 'bg-zinc-300 border-zinc-400' : 'bg-white/10 border-white/15')
              }`}
              style={settings.virtualizer && settings.enabled ? { backgroundColor: activeColor } : {}}
            >
              <div 
                className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                  settings.virtualizer && settings.enabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Done / Apply Button */}
        <div className="mt-4 pt-2">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl font-bold text-xs sm:text-sm text-white shadow-xl hover:brightness-110 active:scale-98 transition-all"
            style={{ backgroundColor: activeColor }}
          >
            Apply & Enjoy Sound
          </button>
        </div>
      </div>
    </div>
  );
};

export default EqualizerModal;
