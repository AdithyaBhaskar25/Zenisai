import React, { useState, useEffect, useRef } from 'react';
import { equalizerService, EQ_BANDS, EQ_PRESETS, EqualizerSettings } from '../services/equalizerService';
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
  const curveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeColor = dominantColor || '#3b82f6';

  useEffect(() => {
    return equalizerService.subscribe(newSettings => {
      setSettings(newSettings);
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
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      // +12dB line
      ctx.beginPath();
      ctx.moveTo(0, h * 0.15);
      ctx.lineTo(w, h * 0.15);
      ctx.stroke();

      // 0dB center line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(w, midY);
      ctx.stroke();

      // -12dB line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
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

        ctx.fillStyle = colorWithAlpha(activeColor, 0.15);
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

      // Edge start anchor
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

      // Edge end anchor
      const lastY = midY - (bands[bands.length - 1] / 12) * (h * 0.35);
      points.push({ x: w, y: Math.max(8, Math.min(h - 8, lastY)) });

      // Smooth Bezier Curve
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);

      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const cpX = (p0.x + p1.x) / 2;
        ctx.bezierCurveTo(cpX, p0.y, cpX, p1.y, p1.x, p1.y);
      }

      ctx.strokeStyle = settings.enabled ? activeColor : 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 3;
      ctx.shadowBlur = settings.enabled ? 16 : 0;
      ctx.shadowColor = activeColor;
      ctx.stroke();

      // Soft glow gradient under the curve - 100% safe valid color stop
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      const fillGrad = ctx.createLinearGradient(0, 0, 0, h);
      fillGrad.addColorStop(0, settings.enabled ? colorWithAlpha(activeColor, 0.28) : 'rgba(255, 255, 255, 0.05)');
      fillGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = fillGrad;
      ctx.fill();

      // Draw anchor dots on curve
      bands.forEach((gain, index) => {
        const x = (w / (bands.length - 1)) * index;
        const boost = index === 0 ? (settings.bassBoost / 100) * 8 : 0;
        const effectiveGain = gain + boost;
        const y = midY - (effectiveGain / 12) * (h * 0.35);

        ctx.beginPath();
        ctx.arc(x, Math.max(8, Math.min(h - 8, y)), 5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = activeColor;
        ctx.fill();
      });
    };

    draw();
    return () => cancelAnimationFrame(animId);
  }, [settings, analyser, isPlaying, activeColor]);

  return (
    <div 
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/75 p-2 sm:p-4 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] backdrop-blur-2xl animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-lg max-h-[92dvh] overflow-y-auto no-scrollbar rounded-[28px] border bg-[var(--color-surface)] p-4 sm:p-6 shadow-2xl transition-all duration-300 animate-in slide-in-from-bottom-4"
        style={{ borderColor: colorWithAlpha(activeColor, 0.3) }}
        onClick={e => e.stopPropagation()}
      >
        {/* Ambient Top Glow */}
        <div 
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-36 rounded-full blur-[90px] pointer-events-none opacity-40 transition-colors duration-500" 
          style={{ backgroundColor: activeColor }}
        />

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg border"
              style={{ backgroundColor: colorWithAlpha(activeColor, 0.15), borderColor: colorWithAlpha(activeColor, 0.4) }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Equalizer & Audio FX
                {settings.enabled && (
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: activeColor }} />
                )}
              </h2>
              <p className="text-[11px] text-white/50">High-fidelity 5-band sound stage</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Master Toggle */}
            <button
              onClick={() => equalizerService.setEnabled(!settings.enabled)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 active:scale-95 ${
                settings.enabled
                  ? 'text-[#06101e] shadow-lg'
                  : 'bg-white/5 text-white/40 border-white/10'
              }`}
              style={settings.enabled ? { backgroundColor: activeColor, borderColor: activeColor } : {}}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${settings.enabled ? 'bg-[#06101e]' : 'bg-white/40'}`} />
              {settings.enabled ? 'ON' : 'BYPASS'}
            </button>

            {/* Close Button */}
            <button 
              onClick={onClose}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all active:scale-90"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Real-time Frequency Response Canvas */}
        <div className="relative mt-3 h-28 sm:h-32 w-full rounded-2xl bg-black/40 border border-white/10 overflow-hidden shadow-inner">
          <canvas ref={curveCanvasRef} className="w-full h-full" />
          <div className="absolute top-2 left-3 text-[9px] font-bold text-white/40 uppercase tracking-widest pointer-events-none">
            +12 dB
          </div>
          <div className="absolute top-1/2 -translate-y-1/2 left-3 text-[9px] font-bold text-white/20 uppercase tracking-widest pointer-events-none">
            0 dB
          </div>
          <div className="absolute bottom-2 left-3 text-[9px] font-bold text-white/40 uppercase tracking-widest pointer-events-none">
            -12 dB
          </div>
        </div>

        {/* Preset Selector Chips */}
        <div className="mt-3.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-white/50">Presets</span>
            <button
              onClick={() => equalizerService.resetFlat()}
              className="text-[10px] font-bold text-white/50 hover:text-white hover:underline transition-colors"
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
                      : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                  }`}
                  style={isActive ? { backgroundColor: activeColor, boxShadow: `0 4px 15px ${colorWithAlpha(activeColor, 0.35)}` } : {}}
                >
                  {preset.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* 5-Band Vertical Equalizer Sliders */}
        <div className="mt-4 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
          <div className="grid grid-cols-5 gap-2 sm:gap-4 items-end">
            {EQ_BANDS.map((band, idx) => {
              const val = settings.bands[idx] ?? 0;
              return (
                <div key={band.frequency} className="flex flex-col items-center gap-2">
                  {/* Gain readout */}
                  <span 
                    className="text-[10px] font-bold tracking-tight transition-colors"
                    style={{ color: val !== 0 && settings.enabled ? activeColor : 'rgba(255,255,255,0.6)' }}
                  >
                    {val > 0 ? `+${val}` : val} dB
                  </span>

                  {/* Vertical Slider Track Container */}
                  <div className="relative h-32 sm:h-40 w-8 flex items-center justify-center">
                    {/* 0dB tick indicator */}
                    <div className="absolute top-1/2 -translate-y-1/2 w-4 h-0.5 bg-white/20 pointer-events-none rounded-full" />

                    <input
                      type="range"
                      min="-12"
                      max="12"
                      step="0.5"
                      disabled={!settings.enabled}
                      value={val}
                      onChange={e => equalizerService.setBand(idx, parseFloat(e.target.value))}
                      className="w-32 sm:w-40 h-8 -rotate-90 appearance-none bg-transparent cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{
                        accentColor: activeColor,
                      }}
                    />
                  </div>

                  {/* Frequency label */}
                  <span className="text-[10px] font-semibold text-white/50 text-center">
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
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-accent" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                Deep Bass Boost
              </span>
              <span className="text-xs font-extrabold" style={{ color: activeColor }}>
                {settings.bassBoost}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              disabled={!settings.enabled}
              value={settings.bassBoost}
              onChange={e => equalizerService.setBassBoost(parseInt(e.target.value))}
              className="w-full h-2 rounded-lg bg-white/10 appearance-none cursor-pointer disabled:opacity-30"
              style={{ accentColor: activeColor }}
            />
          </div>

          {/* 3D Spatial Virtualizer */}
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-white block">3D Spatializer</span>
              <span className="text-[10px] text-white/40">Surround acoustic depth</span>
            </div>
            <button
              onClick={() => equalizerService.setVirtualizer(!settings.virtualizer)}
              disabled={!settings.enabled}
              className={`w-12 h-6 rounded-full p-0.5 transition-colors duration-200 border disabled:opacity-30 ${
                settings.virtualizer && settings.enabled ? 'border-transparent' : 'bg-white/10 border-white/15'
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
            className="w-full py-3 rounded-xl font-bold text-xs sm:text-sm text-[#06101e] shadow-xl hover:brightness-110 active:scale-98 transition-all"
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
