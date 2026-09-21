import React, { useEffect, useRef, useState } from "react";

const chapters = [
  ["Gestão de Obras", 0],
  ["SINAPI Caixa", 4],
  ["Medições & Retenções", 8],
  ["Conciliação & DRE", 12],
  ["Cascata de SLA", 16],
];

export function FeatureTour() {
  const videoRef = useRef(null);
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    function sync() {
      if (!visible || media.matches) video.pause();
      else video.play().catch(() => {});
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        sync();
      },
      { threshold: 0.25 },
    );
    observer.observe(video);
    media.addEventListener("change", sync);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", sync);
      video.pause();
    };
  }, []);

  function selectChapter(index) {
    const video = videoRef.current;
    video.currentTime = chapters[index][1];
    setActive(index);
    video.play().catch(() => {});
  }

  return (
    <section id="tour" aria-labelledby="tour-title" className="bg-void pb-8">
      <div className="wrap">
        <div className="flex flex-col justify-between gap-5 border-y border-line py-5 xl:flex-row xl:items-center">
          <h2
            id="tour-title"
            className="shrink-0 font-display text-xl uppercase"
          >
            Tour interativo <span className="text-acid">FinGo</span>
          </h2>
          <div
            role="group"
            aria-label="Capítulos do tour"
            className="flex flex-wrap gap-2"
          >
            {chapters.map(([label], index) => (
              <button
                key={label}
                type="button"
                disabled={failed}
                aria-pressed={active === index}
                onClick={() => selectChapter(index)}
                className={`rounded-sm border px-3 py-2 text-xs transition-colors disabled:opacity-50 ${active === index ? "border-acid bg-acid font-bold text-void" : "border-line bg-panel text-muted hover:border-acid hover:text-paper"}`}
              >
                {index + 1}. {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="relative isolate mt-4 aspect-video w-full overflow-hidden bg-void">
        <video
          id="fingo-feature-video"
          ref={videoRef}
          muted
          loop
          playsInline
          preload="none"
          poster="/img/fingo/feature-demo-financeiro.png"
          aria-label="Demonstração dos recursos do FinGo"
          onError={() => setFailed(true)}
          onTimeUpdate={() =>
            setActive(
              Math.min(
                chapters.length - 1,
                Math.floor(videoRef.current.currentTime / 4),
              ),
            )
          }
          className="absolute inset-0 h-full w-full object-contain"
        >
          <source
            src="/img/fingo/feature-demo.mp4"
            type="video/mp4"
            onError={() => setFailed(true)}
          />
        </video>
      </div>
      {failed && <p role="status" className="wrap pt-4 text-sm text-muted">O tour está indisponível no momento. Tente novamente mais tarde.</p>}
    </section>
  );
}
