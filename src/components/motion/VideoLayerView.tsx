import { useEffect, useRef } from "react";

interface Props {
  src: string;
  time: number;
  playing: boolean;
}

export function VideoLayerView({ src, time, playing }: Props) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (playing) void video.play().catch(() => undefined);
    else video.pause();
  }, [playing]);

  useEffect(() => {
    const video = ref.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    const target = time % video.duration;
    // While playing, only correct large drift; seeking every frame makes it stutter.
    const limit = playing ? 0.3 : 0.02;
    if (!video.seeking && Math.abs(video.currentTime - target) > limit) video.currentTime = target;
  }, [time, playing]);

  return (
    <video
      ref={ref}
      src={src}
      muted
      loop
      playsInline
      preload="auto"
      draggable={false}
      className="pointer-events-none h-full w-full object-contain"
    />
  );
}