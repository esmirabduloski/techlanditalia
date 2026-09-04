import { useEffect, useRef, useState } from "react";
import videoAsset from "@/assets/hero-360.mp4.asset.json";

const VIDEO_SRC = videoAsset.url;
const SENSITIVITY = 0.8;

/**
 * Video che "scrubba" seguendo il movimento del mouse in tutte le direzioni
 * (orizzontale + verticale). Non è fullscreen: riempie il contenitore.
 */
export function HeroScrubVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const targetTimeRef = useRef(0);
  const seekingRef = useRef(false);
  const prevRef = useRef<{ x: number; y: number } | null>(null);
  // Il blocco hero è visibile solo da lg in su: non scarichiamo il video su mobile/tablet
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsDesktop(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isDesktop) return;

    const seek = () => {
      if (seekingRef.current) return;
      if (Math.abs(video.currentTime - targetTimeRef.current) < 0.01) return;
      seekingRef.current = true;
      video.currentTime = targetTimeRef.current;
    };

    const onSeeked = () => {
      seekingRef.current = false;
      seek();
    };

    const onMouseMove = (e: MouseEvent) => {
      const duration = video.duration;
      if (!duration || Number.isNaN(duration)) return;
      if (prevRef.current === null) {
        prevRef.current = { x: e.clientX, y: e.clientY };
        return;
      }
      const dx = e.clientX - prevRef.current.x;
      const dy = e.clientY - prevRef.current.y;
      prevRef.current = { x: e.clientX, y: e.clientY };

      // Combina movimento orizzontale e verticale: il video segue il mouse
      // in tutte e 4 le direzioni (destra/sinistra e alto/basso).
      const normalized =
        dx / window.innerWidth + dy / window.innerHeight;
      const offset = normalized * SENSITIVITY * duration;

      // Loop continuo: il video è un giro completo a 360°
      let next = (targetTimeRef.current + offset) % duration;
      if (next < 0) next += duration;
      targetTimeRef.current = next;
      seek();
    };

    const onLoaded = () => {
      targetTimeRef.current = 0;
      video.currentTime = 0;
    };

    video.addEventListener("seeked", onSeeked);
    video.addEventListener("loadedmetadata", onLoaded);
    window.addEventListener("mousemove", onMouseMove);

    return () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("loadedmetadata", onLoaded);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [isDesktop]);

  if (!isDesktop) return null;

  return (
    <video
      ref={videoRef}
      src={VIDEO_SRC}
      muted
      playsInline
      preload="auto"
      aria-label="Bambini che imparano programmazione con TECHLAND"
      className="w-full h-full object-cover"
      style={{ objectPosition: "center center" }}
    />
  );
}
