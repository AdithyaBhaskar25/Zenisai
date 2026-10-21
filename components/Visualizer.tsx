import React, { useEffect, useRef } from 'react';
import { VisualizerStyle } from '../services/themeService';

interface VisualizerProps {
  analyser: AnalyserNode | null;
  color: string;
  isPlaying: boolean;
  style?: VisualizerStyle;
  className?: string;
  glow?: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({ 
  analyser, 
  color, 
  isPlaying, 
  style = 'bars', 
  className = "w-full h-full",
  glow = true 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
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

    let animationId: number;
    let phase = 0;

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, rect.width, rect.height);

      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(dataArray);
      } else {
        // Smooth undulating breathing wave when paused
        phase += 0.035;
        for (let i = 0; i < bufferLength; i++) {
          dataArray[i] = Math.floor(Math.sin(phase + (i * 0.22)) * 25 + 32);
        }
      }

      ctx.save();
      if (glow) {
        ctx.shadowBlur = 14;
        ctx.shadowColor = color;
      }

      if (style === 'wave') {
        // --- SMOOTH CONTINUOUS WAVEFORM ---
        ctx.beginPath();
        const activeBins = Math.min(bufferLength, 32);
        const sliceWidth = rect.width / (activeBins - 1);
        const centerY = rect.height / 2;

        ctx.moveTo(0, centerY);
        for (let i = 0; i < activeBins; i++) {
          const v = dataArray[i] / 255;
          const amp = (v - 0.15) * (rect.height * 0.7);
          const x = i * sliceWidth;
          const y = centerY + (i % 2 === 0 ? -amp : amp);

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            const prevX = (i - 1) * sliceWidth;
            const prevV = dataArray[i - 1] / 255;
            const prevAmp = (prevV - 0.15) * (rect.height * 0.7);
            const prevY = centerY + ((i - 1) % 2 === 0 ? -prevAmp : prevAmp);
            const cpX = (prevX + x) / 2;
            ctx.quadraticCurveTo(prevX, prevY, cpX, (prevY + y) / 2);
          }
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(2, rect.height * 0.08);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

      } else if (style === 'pulse') {
        // --- RADIAL / CONCENTRIC PULSING RINGS ---
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const maxRadius = Math.min(centerX, centerY) * 0.85;

        // Calculate average energy in bass/mid
        let sum = 0;
        const sampleCount = Math.min(bufferLength, 16);
        for (let i = 0; i < sampleCount; i++) sum += dataArray[i];
        const avg = sum / sampleCount / 255;

        const baseRadius = Math.max(4, maxRadius * (0.3 + avg * 0.65));

        // Outer glow ring
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(2, 4 * avg);
        ctx.globalAlpha = Math.max(0.3, avg);
        ctx.stroke();

        // Inner solid core
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius * 0.55, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = Math.max(0.4, avg * 1.2);
        ctx.fill();

      } else {
        // --- DYNAMIC FREQUENCY BARS (Default) ---
        const activeLength = Math.max(8, Math.floor(bufferLength * 0.65));
        const barWidth = Math.max(2, (rect.width / activeLength) * 0.7);
        const gap = (rect.width - activeLength * barWidth) / (activeLength - 1);
        let x = 0;

        ctx.fillStyle = color;

        for (let i = 0; i < activeLength; i++) {
          const val = dataArray[i];
          const barHeight = Math.max(3, (val / 255) * (rect.height * 0.9));
          const yTop = (rect.height - barHeight) / 2;

          ctx.globalAlpha = Math.max(0.35, val / 255);
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(x, yTop, barWidth, barHeight, 4);
          } else {
            ctx.rect(x, yTop, barWidth, barHeight);
          }
          ctx.fill();

          x += barWidth + Math.max(1, gap);
        }
      }

      ctx.restore();
    };

    draw();
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [analyser, color, isPlaying, style, glow]);

  return (
    <canvas 
      ref={canvasRef} 
      className={`${className} transition-opacity duration-500`} 
      style={{ width: '100%', height: '100%' }}
    />
  );
};

export default Visualizer;
