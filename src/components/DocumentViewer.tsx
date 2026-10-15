import { useEffect, useRef, useState } from "react";
import PdfCanvasViewer from "@/components/PdfCanvasViewer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Hand, MessageSquarePlus, Maximize2, ZoomIn, ZoomOut, Trash2, X, CheckCircle2 } from "lucide-react";

export interface DocAnnotation {
  id: string;
  page: number;
  x: number;
  y: number;
  comment: string;
  author: string;
  resolved: boolean;
  created_at: string;
}

interface Props {
  src: string;
  isImage: boolean;
  alt?: string;
  annotations: DocAnnotation[];
  canAnnotate: boolean;
  onAdd?: (a: { page: number; x: number; y: number; comment: string }) => Promise<void> | void;
  onDelete?: (id: string) => void;
  onResolve?: (id: string) => void;
  protect?: boolean;
}

const MIN = 50, MAX = 400;

export default function DocumentViewer({ src, isImage, alt, annotations, canAnnotate, onAdd, onDelete, onResolve, protect }: Props) {
  const [zoom, setZoom] = useState(100);
  const [mode, setMode] = useState<"pan" | "note">("pan");
  const [pending, setPending] = useState<{ page: number; x: number; y: number } | null>(null);
  const [draft, setDraft] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [baseW, setBaseW] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; sl: number; st: number; moved: boolean } | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    setBaseW(el.clientWidth);
    const ro = new ResizeObserver(() => setBaseW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const applyZoom = (next: number, ax?: number, ay?: number) => {
    const el = scrollRef.current;
    const prev = zoomRef.current;
    next = Math.round(Math.min(MAX, Math.max(MIN, next)));
    if (!el || next === prev) return setZoom(next);
    const px = ax ?? el.clientWidth / 2, py = ay ?? el.clientHeight / 2;
    const k = next / prev;
    const cx = el.scrollLeft + px, cy = el.scrollTop + py;
    setZoom(next);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.scrollLeft = cx * k - px;
      el.scrollTop = cy * k - py;
    }));
  };

  // Ctrl/pinch + wheel zoom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      applyZoom(zoomRef.current * Math.exp(-dy * 0.01), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (mode !== "pan" || e.pointerType === "touch") return;
    const el = scrollRef.current!;
    drag.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const el = scrollRef.current!;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    el.scrollLeft = d.sl - dx;
    el.scrollTop = d.st - dy;
  };
  const endDrag = () => { drag.current = null; };

  const pageClick = (page: number, x: number, y: number) => {
    if (mode !== "note" || !canAnnotate) return;
    setPending({ page, x, y });
    setDraft("");
  };

  const ordered = [...annotations].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const numOf = (id: string) => ordered.findIndex((a) => a.id === id) + 1;

  const overlay = (page: number) => (
    <>
      {ordered.filter((a) => (a.page || 1) === page).map((a) => (
        <button
          key={a.id}
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setActive(active === a.id ? null : a.id); }}
          title={a.comment}
          className={`absolute z-10 -translate-x-1/2 -translate-y-full flex h-7 w-7 items-center justify-center rounded-full rounded-bl-none text-[11px] font-semibold shadow-md ring-2 ring-background transition hover:scale-110 ${
            a.resolved ? "bg-accent text-accent-foreground" : "bg-destructive text-destructive-foreground"
          } ${active === a.id ? "scale-125" : ""}`}
          style={{ left: `${a.x}%`, top: `${a.y}%` }}
        >
          {numOf(a.id)}
        </button>
      ))}
      {pending && pending.page === page && (
        <span
          className="absolute z-10 -translate-x-1/2 -translate-y-full flex h-7 w-7 items-center justify-center rounded-full rounded-bl-none bg-primary text-primary-foreground text-xs font-bold ring-2 ring-background animate-pulse"
          style={{ left: `${pending.x}%`, top: `${pending.y}%` }}
        >+</span>
      )}
    </>
  );

  const save = async () => {
    if (!pending || !draft.trim() || !onAdd) return;
    await onAdd({ ...pending, comment: draft.trim() });
    setPending(null);
    setDraft("");
  };

  const cursor = mode === "note" ? "cursor-crosshair" : drag.current ? "cursor-grabbing" : "cursor-grab";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex rounded-md border border-border p-0.5">
          <Button size="sm" variant={mode === "pan" ? "secondary" : "ghost"} className="h-7" onClick={() => setMode("pan")}>
            <Hand className="h-3.5 w-3.5 mr-1" /> Déplacer
          </Button>
          {canAnnotate && (
            <Button size="sm" variant={mode === "note" ? "default" : "ghost"} className="h-7" onClick={() => setMode("note")}>
              <MessageSquarePlus className="h-3.5 w-3.5 mr-1" /> Annoter
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => applyZoom(zoom - 25)} aria-label="Dézoomer">
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <input
            type="range" min={MIN} max={MAX} step={5} value={zoom}
            onChange={(e) => applyZoom(Number(e.target.value))}
            className="w-24 accent-primary hidden sm:block" aria-label="Zoom"
          />
          <span className="text-[11px] tabular-nums text-muted-foreground w-10 text-center">{zoom}%</span>
          <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => applyZoom(zoom + 25)} aria-label="Zoomer">
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => applyZoom(100)}>
            <Maximize2 className="h-3.5 w-3.5 mr-1" /> Ajuster
          </Button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {mode === "note"
          ? "Cliquez à l'endroit exact du document où vous souhaitez une modification."
          : "Cliquez-glissez pour vous déplacer · Ctrl + molette (ou pincer) pour zoomer."}
      </p>

      <div
        ref={scrollRef}
        className={`relative w-full h-[75vh] rounded-md overflow-auto bg-muted select-none ${cursor}`}
        style={{ touchAction: mode === "pan" ? "pan-x pan-y pinch-zoom" : "manipulation" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onContextMenu={(e) => protect && e.preventDefault()}
      >
        {isImage ? (
          <div className="w-max min-w-full flex justify-center p-2">
            <div
              className="relative"
              style={{ width: baseW ? `${((baseW - 16) * zoom) / 100}px` : "100%" }}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                pageClick(1, ((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
              }}
            >
              <img src={src} alt={alt} draggable={false} className="block w-full h-auto max-w-none select-none" />
              {overlay(1)}
            </div>
          </div>
        ) : (
          baseW > 0 && <PdfCanvasViewer src={src} zoom={zoom} baseWidth={baseW} overlay={overlay} onPageClick={pageClick} />
        )}
      </div>

      {pending && (
        <div className="rounded-md border border-primary bg-card p-3 space-y-2">
          <div className="text-xs font-semibold">Nouvelle annotation · page {pending.page}</div>
          <Textarea autoFocus rows={3} value={draft} maxLength={2000} onChange={(e) => setDraft(e.target.value)} placeholder="Décrivez la modification souhaitée à cet endroit…" />
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={!draft.trim()}>Ajouter l'annotation</Button>
            <Button size="sm" variant="ghost" onClick={() => setPending(null)}><X className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      )}

      {ordered.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Annotations ({ordered.length})</div>
          {ordered.map((a) => (
            <div
              key={a.id}
              onClick={() => setActive(a.id)}
              className={`flex items-start gap-2 rounded-md border p-2 text-xs cursor-pointer ${active === a.id ? "border-primary" : "border-border"}`}
            >
              <span className={`shrink-0 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${a.resolved ? "bg-accent text-accent-foreground" : "bg-destructive text-destructive-foreground"}`}>
                {numOf(a.id)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="whitespace-pre-wrap text-foreground">{a.comment}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Page {a.page} · {new Date(a.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                  {a.resolved && " · Corrigé"}
                </div>
              </div>
              {onResolve && !a.resolved && (
                <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={(e) => { e.stopPropagation(); onResolve(a.id); }}>
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Corrigé
                </Button>
              )}
              {onDelete && !a.resolved && (
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(a.id); }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
