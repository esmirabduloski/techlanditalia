import { useEffect, useRef } from "react";
import heroVideo from "@/assets/hero-kids-scrub.mp4.asset.json";

const VIDEO_SRC = heroVideo.url;
/** Quanto velocemente lo sguardo raggiunge la posizione del mouse (0-1 per frame) */
const SMOOTHING = 0.18;

/**
 * Il video è una singola "spazzata" dello sguardo: sinistra -> alto -> avanti -> basso.
 * Mappiamo l'angolo del mouse attorno al centro del video su quella timeline,
 * così i bambini guardano davvero verso il puntatore (anche in alto e in basso).
 */
export function HeroScrubVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const targetTimeRef = useRef(0);
  const currentTimeRef = useRef(0);
  const seekingRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let rafId = 0;

    const seek = () => {
      if (seekingRef.current) return;
      if (Math.abs(video.currentTime - currentTimeRef.current) < 0.02) return;
      seekingRef.current = true;
      video.currentTime = currentTimeRef.current;
    };

    const onSeeked = () => {
      seekingRef.current = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      const duration = video.duration;
      if (!duration || Number.isNaN(duration)) return;

      const rect = video.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      // Angolo in gradi: 180 = mouse a sinistra, 90 = in alto, 0 = a destra, -90 = in basso
      const angle =
        (Math.atan2(cy - e.clientY, e.clientX - cx) * 180) / Math.PI;

      // 180 -> 0 (inizio video, sguardo a sinistra) ... -90 -> 1 (fine video, sguardo in basso)
      const progress = Math.min(Math.max((180 - angle) / 270, 0), 1);
      targetTimeRef.current = progress * duration;
    };

    const tick = () => {
      currentTimeRef.current +=
        (targetTimeRef.current - currentTimeRef.current) * SMOOTHING;
      seek();
      rafId = requestAnimationFrame(tick);
    };

    const onLoaded = () => {
      targetTimeRef.current = video.duration * 0.7; // sguardo "avanti" iniziale
      currentTimeRef.current = targetTimeRef.current;
      video.currentTime = currentTimeRef.current;
    };

    video.addEventListener("seeked", onSeeked);
    video.addEventListener("loadedmetadata", onLoaded);
    window.addEventListener("mousemove", onMouseMove);
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("loadedmetadata", onLoaded);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);


  return (
    <video
      ref={videoRef}
      src={VIDEO_SRC}
      muted
      playsInline
      preload="auto"
      aria-label="Bambini che imparano programmazione con TECHLAND"
      className="w-full h-full object-cover"
      style={{ objectPosition: "70% center" }}
    />
  );
}
