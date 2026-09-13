import { useEffect, useRef, useState } from "react";
// Clip "sinistra-destra" (1280x720, 1,56 s): i bambini spostano lo sguardo da
// sinistra a destra seguendo il mouse. Vive nel repo (src/assets ->
// /assets/sinistra-destra-<hash>.mp4, cache immutable) ed è rimuxata in
// fast-start (moov in testa) così durata e seek sono pronti subito.
// Prima puntava a un asset dello storage Lovable che era stato cancellato (404).
import sinistraDestraVideo from "@/assets/sinistra-destra.mp4";

const VIDEO_SRC = sinistraDestraVideo;
const SENSITIVITY = 0.8;


/**
 * Video che "scrubba" avanti/indietro seguendo il movimento orizzontale del mouse.
 * Non è fullscreen: riempie il contenitore in cui viene montato.
 */
export function HeroScrubVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const targetTimeRef = useRef(0);
  const seekingRef = useRef(false);
  const prevXRef = useRef<number | null>(null);
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
      if (prevXRef.current === null) {
        prevXRef.current = e.clientX;
        return;
      }
      const delta = e.clientX - prevXRef.current;
      prevXRef.current = e.clientX;
      const offset = (delta / window.innerWidth) * SENSITIVITY * duration;
      targetTimeRef.current = Math.min(
        Math.max(targetTimeRef.current + offset, 0),
        duration
      );
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
