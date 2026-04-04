import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  analyser: AnalyserNode | null;
  color: string;
  className?: string;
}

const Visualizer: React.FC<VisualizerProps> = ({ analyser, color, className = "w-full h-full" }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!analyser || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high-DPI displays for sharpness
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const bufferLength = analyser.frequencyBinCount;
    // We only use the lower 60% of frequencies for a better "bass-heavy" visual
    const activeLength = Math.floor(bufferLength * 0.6);
    const dataArray = new Uint8Array(bufferLength);

    let animationId: number;

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      // Clear with a transparent finish for AMOLED backgrounds
      ctx.clearRect(0, 0, rect.width, rect.height);

      const barWidth = (rect.width / activeLength) * 2.5;
      let x = 0;

      // Visual styling
      ctx.lineCap = 'round';
      ctx.lineWidth = 3;
      ctx.shadowBlur = 15;
      ctx.shadowColor = color;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;

      for (let i = 0; i < activeLength; i++) {
        // Calculate height based on frequency intensity
        // Adding a small multiplier to make it pop more
        const val = dataArray[i];
        const barHeight = (val / 255) * (rect.height * 0.8);

        // Center vertically for a "Pulse" look
        const yTop = (rect.height - barHeight) / 2;

        // Draw pill-shaped bars
        if (barHeight > 2) {
          // Subtle opacity based on frequency height
          ctx.globalAlpha = Math.max(0.2, val / 255);
          
          // Draw rounded rectangle (pill)
          ctx.beginPath();
          ctx.roundRect(x, yTop, barWidth - 1, barHeight, 10);
          ctx.fill();
        }

        x += barWidth + 1;
      }
    };

    draw();
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [analyser, color]);

  return (
    <canvas 
      ref={canvasRef} 
      className={`${className} transition-opacity duration-1000`} 
      style={{ width: '100%', height: '100%' }}
    />
  );
};

export default Visualizer;
