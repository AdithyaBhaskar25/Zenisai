import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  analyser: AnalyserNode | null;
  color: string;
  isPlaying: boolean;
  className?: string;
}

const Visualizer: React.FC<VisualizerProps> = ({ analyser, color, isPlaying, className = "w-full h-full" }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high-DPI displays for sharpness
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const bufferLength = analyser ? analyser.frequencyBinCount : 32;
    const activeLength = Math.floor(bufferLength * 0.6);
    const dataArray = new Uint8Array(bufferLength);

    let animationId: number;
    let phase = 0;

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, rect.width, rect.height);

      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(dataArray);
      } else {
        // Idle gentle breathing animation when paused or no analyser
        phase += 0.04;
        for (let i = 0; i < activeLength; i++) {
          dataArray[i] = Math.floor(Math.sin(phase + (i * 0.2)) * 30 + 35);
        }
      }

      const barWidth = Math.max(2, (rect.width / activeLength) * 2.2);
      let x = 0;

      // Visual styling & ambient glow pass
      ctx.lineCap = 'round';
      ctx.shadowBlur = 18;
      ctx.shadowColor = color;
      ctx.fillStyle = color;

      for (let i = 0; i < activeLength; i++) {
        const val = dataArray[i];
        const barHeight = Math.max(4, (val / 255) * (rect.height * 0.85));
        const yTop = (rect.height - barHeight) / 2;

        if (barHeight > 2) {
          // Dynamic alpha for depth
          ctx.globalAlpha = Math.max(0.25, val / 255);
          
          // Draw rounded pill bar
          ctx.beginPath();
          ctx.roundRect(x, yTop, Math.max(1, barWidth - 1.5), barHeight, 10);
          ctx.fill();
        }

        x += barWidth + 1.5;
      }
    };

    draw();
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [analyser, color, isPlaying]);

  return (
    <canvas 
      ref={canvasRef} 
      className={`${className} transition-opacity duration-1000`} 
      style={{ width: '100%', height: '100%' }}
    />
  );
};

export default Visualizer;
