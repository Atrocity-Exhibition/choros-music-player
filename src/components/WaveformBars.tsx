interface WaveformBarsProps {
  className?: string;
}

export function WaveformBars({ className = "" }: WaveformBarsProps) {
  return (
    <div className={`flex items-end gap-[2px] h-3.5 w-3.5 ${className}`}>
      <div className="w-[2px] bg-white rounded-full animate-waveform-1" />
      <div className="w-[2px] bg-white rounded-full animate-waveform-2" />
      <div className="w-[2px] bg-white rounded-full animate-waveform-3" />
      <div className="w-[2px] bg-white rounded-full animate-waveform-4" />
    </div>
  );
}
