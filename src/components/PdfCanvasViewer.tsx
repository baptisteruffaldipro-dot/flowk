import { ReactNode, useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - worker asset URL
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

interface Props {
  src: string;
  zoom: number; // percentage of container width
  baseWidth?: number; // fixed width reference (px) to avoid feedback loops
  overlay?: (page: number) => ReactNode;
  onPageClick?: (page: number, x: number, y: number) => void;
}

export default function PdfCanvasViewer({ src, zoom, baseWidth, overlay, onPageClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const docRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setPages(0);
    (async () => {
      try {
        const doc = await pdfjsLib.getDocument({ url: src }).promise;
        if (cancelled) return;
        docRef.current = doc;
        setPages(doc.numPages);
      } catch {
        if (!cancelled) setError("Aperçu indisponible");
      }
    })();
    return () => {
      cancelled = true;
      docRef.current?.destroy?.();
      docRef.current = null;
    };
  }, [src]);

  useEffect(() => {
    const doc = docRef.current;
    const container = containerRef.current;
    if (!doc || !container || !pages) return;
    let cancelled = false;
    (async () => {
      const width = (baseWidth || container.clientWidth || 320) - 16;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      for (let i = 1; i <= pages; i++) {
        if (cancelled) return;
        const canvas = container.querySelector<HTMLCanvasElement>(`canvas[data-page="${i}"]`);
        if (!canvas) continue;
        const page = await doc.getPage(i);
        const base = page.getViewport({ scale: 1 });
        const scale = ((width * (zoom / 100)) / base.width) * dpr;
        const viewport = page.getViewport({ scale });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / dpr}px`;
        canvas.style.height = `${viewport.height / dpr}px`;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
      }
    })();
    return () => { cancelled = true; };
  }, [pages, zoom, src, baseWidth]);

  if (error) {
    return <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">{error}</div>;
  }

  return (
    <div ref={containerRef} className="w-max min-w-full flex flex-col items-center gap-3 p-2">
      {Array.from({ length: pages }, (_, i) => (
        <div
          key={i}
          className="relative"
          onClick={(e) => {
            if (!onPageClick) return;
            const r = e.currentTarget.getBoundingClientRect();
            onPageClick(i + 1, ((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
          }}
        >
          <canvas data-page={i + 1} className="block shadow-sm bg-white max-w-none" />
          <span className="absolute bottom-1 right-1 rounded bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {i + 1}/{pages}
          </span>
          {overlay?.(i + 1)}
        </div>
      ))}
      {!pages && <div className="py-10 text-xs text-muted-foreground">Chargement du document…</div>}
    </div>
  );
}
