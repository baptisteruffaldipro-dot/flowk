import type { LogoPresentation, LogoVariant } from "@/data/logo-presentations/types";

interface Props {
  presentation: LogoPresentation;
}

// Render rich-text HTML if present, otherwise fall back to plain text with line breaks preserved.
// Wrapper forces normal weight/style so the user's own formatting (bold, italic, alignment, headings) is what shows.
const RichText = ({ html, className }: { html?: string; className?: string }) => {
  if (!html) return null;
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(html);
  if (looksLikeHtml) {
    return (
      <div
        className={`rich-text prose prose-neutral max-w-none ${className ?? ""}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return <div className={`whitespace-pre-line ${className ?? ""}`}>{html}</div>;
};

const SectionLabel = ({ number, title }: { number: string; title: string }) => (
  <div className="flex items-baseline gap-6 mb-12">
    <span className="font-serif text-5xl md:text-7xl text-accent leading-none">{number}</span>
    <h2 className="font-serif text-2xl md:text-3xl tracking-tight text-foreground">{title}</h2>
  </div>
);

const Divider = () => (
  <div className="my-24 md:my-32 flex justify-center">
    <span className="h-px w-24 bg-foreground/20" />
  </div>
);

const VariantBlock = ({ v, index }: { v: LogoVariant; index: string }) => {
  const [hero, ...rest] = v.shots;
  const squares = rest.slice(0, 2);
  return (
  <article className="grid md:grid-cols-12 gap-8 md:gap-12">
    <div className="md:col-span-4">
      <div className="text-7xl md:text-8xl italic font-light text-accent leading-none mb-4">{index}</div>
      <h3 className="text-3xl md:text-4xl italic font-normal leading-tight mb-4">{v.label}</h3>
      {v.description && (
        <RichText html={v.description} className="text-base font-normal text-muted-foreground leading-snug mb-4 bs-sans" />
      )}
      {v.usage && (
        <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-2 bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
          Usage
        </div>
      )}
      {v.usage && <p className="text-sm font-normal whitespace-pre-line bs-sans">{v.usage}</p>}
    </div>
    <div className="md:col-span-8">
      {v.shots.length === 0 ? (
        <div className="border border-dashed border-foreground/20 aspect-video flex items-center justify-center text-sm text-muted-foreground">
          Aucun visuel pour cette variante
        </div>
      ) : (
        <div className="space-y-4">
          {hero && (
            <div className="space-y-2">
              <div className="aspect-[16/9] overflow-hidden rounded bg-muted/20">
                <img src={hero.imageUrl} alt={hero.caption ?? v.label} className="w-full h-full object-cover" />
              </div>
              {hero.caption && <div className="text-xs text-muted-foreground italic">{hero.caption}</div>}
            </div>
          )}
          {squares.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              {squares.map((s, i) => (
                <div key={i} className="space-y-2">
                  <div className="aspect-square overflow-hidden rounded bg-muted/20">
                    <img src={s.imageUrl} alt={s.caption ?? v.label} className="w-full h-full object-cover" />
                  </div>
                  {s.caption && <div className="text-xs text-muted-foreground italic">{s.caption}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  </article>
  );
};

export default function LogoPresentationView({ presentation }: Props) {
  const p = presentation;
  const universeCount = p.moodboard.universes.length;
  const trackCount = p.logos.tracks.length;
  const pad = (n: number) => String(n).padStart(2, "0");
  const logosStart = 2 + universeCount;
  const colorsStart = logosStart + trackCount;
  const typoStart = colorsStart + p.colors.tracks.length;
  const inSituStart = typoStart + p.typography.tracks.length;
  return (
    <div className="bg-background text-foreground">
      <style>{`
        .bs-serif { font-family: "Cormorant Garamond", "Playfair Display", Georgia, serif; }
        .bs-mono { font-family: "JetBrains Mono", ui-monospace, "SF Mono", monospace; }
        .bs-sans { font-family: "DM Sans", "Helvetica Neue", Arial, sans-serif; }
        /* Rich text — let user formatting drive style */
        .rich-text, .rich-text p, .rich-text li { font-family: "DM Sans", "Helvetica Neue", Arial, sans-serif; font-style: normal; font-weight: 400; line-height: 1.45; font-size: 0.95em; }
        .rich-text strong { font-weight: 700; }
        .rich-text em { font-style: italic; }
        .rich-text u { text-decoration: underline; }
        .rich-text h1 { font-size: 2.25em; font-weight: 600; line-height: 1.05; margin: 0.5em 0 0.3em; }
        .rich-text h2 { font-size: 1.6em; font-weight: 600; line-height: 1.15; margin: 0.5em 0 0.25em; }
        .rich-text h3 { font-size: 1.25em; font-weight: 600; line-height: 1.25; margin: 0.4em 0 0.2em; }
        .rich-text p { margin: 0 0 0.25em !important; }
        .rich-text p:empty::before { content: "\\00a0"; }
        .rich-text p:has(> br:only-child)::before { content: "\\00a0"; }
        .rich-text p:last-child { margin-bottom: 0 !important; }
        .rich-text > * + * { margin-top: 0 !important; }
        .rich-text br { display: block; content: ""; }
        .rich-text ul { list-style: disc; padding-left: 1.4em; margin: 0.5em 0; }
        .rich-text ol { list-style: decimal; padding-left: 1.4em; margin: 0.5em 0; }
        .rich-text blockquote { border-left: 3px solid hsl(var(--accent)); padding-left: 1em; font-style: italic; margin: 0.75em 0; color: hsl(var(--muted-foreground)); }
        .rich-text [style*="text-align:center"], .rich-text [style*="text-align: center"] { text-align: center; }
        .rich-text [style*="text-align:right"], .rich-text [style*="text-align: right"] { text-align: right; }
        .rich-text [style*="text-align:left"], .rich-text [style*="text-align: left"] { text-align: left; }
      `}</style>
      {/* @font-face for uploaded font files */}
      <style>{
        p.typography.tracks
          .flatMap((tt) => tt.fonts)
          .filter((f) => f.fontFileUrl && f.name)
          .map(
            (f) =>
              `@font-face { font-family: "${f.name.replace(/"/g, "")}"; src: url("${f.fontFileUrl}") format("${f.fontFileFormat || "truetype"}"); font-display: swap; }`
          )
          .join("\n")
      }</style>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@300;400&display=swap"
      />
      {Array.from(new Set(
        p.typography.tracks.flatMap((tt) =>
          tt.fonts
            .map((f) => {
              const raw = (f.googleFontUrl || "").trim();
              if (!raw) return null;
              // Extract href from <link ... href="..."> if user pasted full tag
              const m = raw.match(/href=["']([^"']+)["']/);
              return m ? m[1] : raw;
            })
            .filter((u): u is string => !!u)
        )
      )).map((href) => (
        <link key={href} rel="stylesheet" href={href} />
      ))}

      <div className="font-serif" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}>
        {/* HERO */}
        <section className="min-h-[80vh] flex flex-col justify-between px-6 md:px-16 py-16 border-b border-foreground/10">
          <div className="flex justify-between text-xs tracking-widest uppercase text-muted-foreground bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
            <span>{p.client}</span>
            <span>{p.version}</span>
          </div>
          <div className="my-16 max-w-5xl">
            <div className="text-xs tracking-[0.3em] uppercase text-accent mb-8 bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
              Présentation logo
            </div>
            <h1 className="text-5xl md:text-8xl leading-[0.95] tracking-tight font-light italic">
              {p.tagline || p.projectName}
            </h1>
          </div>
          <div className="flex justify-between items-end text-xs tracking-widest uppercase text-muted-foreground bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
            <span>Pistes de logo</span>
            <span>↓ Faire défiler</span>
          </div>
        </section>

        <div className="px-6 md:px-16 py-24 max-w-6xl mx-auto">
          {/* 01 — Brief */}
          <section>
            <SectionLabel number="01" title="Brief & contexte" />
          {p.brief.intro && (
              <RichText html={p.brief.intro} className="text-base md:text-lg font-normal leading-snug max-w-2xl mb-12 bs-sans" />
            )}
            <div className="grid md:grid-cols-2 gap-12">
              {p.brief.objectives.length > 0 && (
                <div>
                  <div className="text-xs tracking-[0.3em] uppercase text-accent mb-6 bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                    Objectifs
                  </div>
                  <ul className="space-y-3">
                    {p.brief.objectives.map((o, i) => (
                      <li key={i} className="text-base font-normal border-l-2 border-accent/40 pl-4 bs-sans">{o}</li>
                    ))}
                  </ul>
                </div>
              )}
              {p.brief.deliverables.length > 0 && (
                <div>
                  <div className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-6 bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                    Livrables
                  </div>
                  <ul className="space-y-3">
                    {p.brief.deliverables.map((o, i) => (
                      <li key={i} className="text-base font-normal border-l border-foreground/20 pl-4 bs-sans">{o}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>

          <Divider />

          {/* 02+ — Moodboard (univers) */}
          {p.moodboard.universes.map((u, ui) => {
            const number = pad(2 + ui);
            return (
              <div key={`u-${ui}`}>
                <section>
                  <SectionLabel number={number} title={u.name || `Univers ${ui + 1}`} />
                  {u.intro && (
                    <RichText html={u.intro} className="text-base md:text-lg font-normal text-foreground max-w-2xl mb-12 leading-snug bs-sans" />
                  )}
                  {u.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-3 mb-12">
                      {u.keywords.map((k, i) => (
                        <span key={i} className="px-4 py-2 border border-foreground/20 text-sm font-medium bs-sans">{k}</span>
                      ))}
                    </div>
                  )}
                  {u.images.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {u.images.map((img, i) => (
                        <figure key={i} className="space-y-2">
                          <img src={img.url} alt={img.caption ?? `Référence ${i + 1}`} className="w-full aspect-square object-cover rounded" />
                          {img.caption && <figcaption className="text-xs text-muted-foreground italic">{img.caption}</figcaption>}
                        </figure>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground italic">Pas encore de références.</div>
                  )}
                </section>
                <Divider />
              </div>
            );
          })}

          {/* Pistes de logo */}
          {p.logos.tracks.map((track, ti) => {
            const number = pad(logosStart + ti);
            return (
              <div key={ti}>
                <section>
                  <SectionLabel number={number} title={track.name || `Piste ${ti + 1}`} />
                  {track.intro && (
                    <RichText html={track.intro} className="text-base md:text-lg font-normal text-foreground max-w-2xl mb-16 leading-snug bs-sans" />
                  )}
                  <div className="space-y-24">
                    <VariantBlock v={track.primary} index="01" />
                    <VariantBlock v={track.secondary} index="02" />
                    <VariantBlock v={track.submark} index="03" />
                  </div>
                </section>
                <Divider />
              </div>
            );
          })}

          {/* Couleurs (multi-pistes) */}
          {p.colors.tracks.map((ct, i) => (
            <div key={`c-${i}`}>
              <section>
                <SectionLabel number={pad(colorsStart + i)} title={ct.name || `Palette ${i + 1}`} />
                {ct.intro && (
                  <RichText html={ct.intro} className="text-base md:text-lg font-normal text-foreground max-w-2xl mb-12 leading-snug bs-sans" />
                )}
                {ct.palette.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-foreground/10 border border-foreground/10">
                    {ct.palette.map((c, j) => (
                      <div key={j} className="bg-background">
                        <div className="h-48" style={{ backgroundColor: c.hex }} />
                        <div className="p-6 space-y-1">
                          <div className="text-xl italic font-light">{c.name}</div>
                          <div className="text-xs uppercase tracking-widest text-muted-foreground bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                            {c.hex}
                          </div>
                          {c.usage && <div className="text-sm text-muted-foreground italic mt-2">{c.usage}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground italic">Pas encore de couleurs.</div>
                )}
              </section>
              <Divider />
            </div>
          ))}

          {/* Typographies (multi-pistes) */}
          {p.typography.tracks.map((tt, i) => (
            <div key={`t-${i}`}>
              <section>
                <SectionLabel number={pad(typoStart + i)} title={tt.name || `Typographies ${i + 1}`} />
                {tt.intro && (
                  <RichText html={tt.intro} className="text-base md:text-lg font-normal text-foreground max-w-2xl mb-12 leading-snug bs-sans" />
                )}
                {tt.fonts.length > 0 ? (
                  <div className="grid md:grid-cols-3 gap-px bg-foreground/10 border border-foreground/10">
                    {tt.fonts.map((f, j) => (
                      <div key={j} className="bg-background p-8 space-y-4">
                        <div className="text-[10px] tracking-[0.3em] uppercase text-accent bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                          {f.role}
                        </div>
                        <div className="text-2xl md:text-3xl font-normal leading-tight whitespace-nowrap" style={{ fontFamily: f.name }}>
                          {f.sample || "Aa Bb"}
                        </div>
                        <div className="text-sm italic">{f.name}</div>
                        {f.usage && <div className="text-sm text-muted-foreground italic">{f.usage}</div>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground italic">Pas encore de typographies.</div>
                )}
              </section>
              <Divider />
            </div>
          ))}

          {/* En action (multi-pistes) */}
          {p.inSitu.tracks.map((it, i) => {
            const isLast = i === p.inSitu.tracks.length - 1;
            return (
              <div key={`is-${i}`}>
                <section className={isLast ? "pb-16" : undefined}>
                  <SectionLabel number={pad(inSituStart + i)} title={it.name || `En action ${i + 1}`} />
                  {it.intro && (
                    <RichText html={it.intro} className="text-base md:text-lg font-normal text-foreground max-w-2xl mb-12 leading-snug bs-sans" />
                  )}
                  {it.items.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {it.items.map((m, j) => (
                        <figure key={j} className="space-y-3">
                          <img src={m.url} alt={m.title ?? `Mise en situation ${j + 1}`} className="w-full aspect-[4/3] object-cover rounded" />
                          {(m.title || m.caption) && (
                            <figcaption className="space-y-1">
                              {m.title && <div className="text-lg italic font-light">{m.title}</div>}
                              {m.caption && <div className="text-sm text-muted-foreground italic">{m.caption}</div>}
                            </figcaption>
                          )}
                        </figure>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground italic">Pas encore de mise en situation.</div>
                  )}
                </section>
                {!isLast && <Divider />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}