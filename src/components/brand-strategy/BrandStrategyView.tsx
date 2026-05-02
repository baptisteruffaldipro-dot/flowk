import type { BrandStrategy } from "@/data/brand-strategies/types";

interface Props {
  strategy: BrandStrategy;
}

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

export default function BrandStrategyView({ strategy }: Props) {
  return (
    <div className="bg-background text-foreground">
      <style>{`
        .bs-serif { font-family: "Cormorant Garamond", "Playfair Display", Georgia, serif; }
        .bs-mono { font-family: "JetBrains Mono", ui-monospace, "SF Mono", monospace; }
      `}</style>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@300;400&display=swap"
      />

      <div className="font-serif" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}>
        {/* HERO */}
        <section className="min-h-[80vh] flex flex-col justify-between px-6 md:px-16 py-16 border-b border-foreground/10">
          <div className="flex justify-between text-xs tracking-widest uppercase text-muted-foreground bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
            <span>{strategy.client}</span>
            <span>{strategy.version}</span>
          </div>
          <div className="my-16 max-w-5xl">
            <div className="text-xs tracking-[0.3em] uppercase text-accent mb-8 bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
              Stratégie de marque
            </div>
            <h1 className="text-5xl md:text-8xl leading-[0.95] tracking-tight font-light italic">
              {strategy.tagline}
            </h1>
          </div>
          <div className="flex justify-between items-end text-xs tracking-widest uppercase text-muted-foreground bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
            <span>Document de travail</span>
            <span>↓ Faire défiler</span>
          </div>
        </section>

        <div className="px-6 md:px-16 py-24 max-w-7xl mx-auto">
          {/* 01 — Positionnement */}
          <section>
            <SectionLabel number="01" title="Positionnement" />
            <p className="text-3xl md:text-5xl font-light leading-tight max-w-4xl">
              {strategy.positioning}
            </p>
          </section>

          <Divider />

          {/* 02 — Promesse */}
          <section>
            <SectionLabel number="02" title="Promesse client" />
            <blockquote className="text-4xl md:text-6xl italic font-light max-w-5xl mb-20 leading-tight">
              « {strategy.promise.headline} »
            </blockquote>
            <div className="grid md:grid-cols-2 gap-px bg-foreground/10 border border-foreground/10">
              <div className="bg-background p-10 md:p-14">
                <div className="text-xs tracking-[0.25em] uppercase text-muted-foreground mb-6 bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                  Le client avant
                </div>
                <p className="text-xl md:text-2xl font-light leading-relaxed text-muted-foreground">
                  {strategy.promise.before}
                </p>
              </div>
              <div className="bg-background p-10 md:p-14">
                <div className="text-xs tracking-[0.25em] uppercase text-accent mb-6 bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                  Le client après
                </div>
                <p className="text-xl md:text-2xl font-light leading-relaxed">
                  {strategy.promise.after}
                </p>
              </div>
            </div>
          </section>

          <Divider />

          {/* 03 — Signature */}
          <section>
            <SectionLabel number="03" title="Signature & fil de communication" />
            <div className="grid md:grid-cols-2 gap-16">
              <div>
                <div className="text-xs tracking-[0.25em] uppercase text-muted-foreground mb-6 bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                  Signature
                </div>
                <p className="text-3xl md:text-4xl italic font-light leading-tight">
                  {strategy.signature.signature}
                </p>
              </div>
              <div>
                <div className="text-xs tracking-[0.25em] uppercase text-muted-foreground mb-6 bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                  Fil de communication
                </div>
                <p className="text-3xl md:text-4xl italic font-light leading-tight">
                  {strategy.signature.thread}
                </p>
              </div>
            </div>
          </section>

          <Divider />

          {/* 04 — Storytelling */}
          <section>
            <SectionLabel number="04" title="Storytelling de marque" />
            <h3 className="text-4xl md:text-6xl font-light italic mb-16 max-w-4xl leading-tight">
              {strategy.storytelling.title}
            </h3>
            <div className="grid md:grid-cols-12 gap-12">
              <div className="md:col-span-8 space-y-8">
                {strategy.storytelling.paragraphs.map((p, i) => (
                  <p key={i} className="text-xl md:text-2xl font-light leading-relaxed">
                    {i === 0 && <span className="float-left text-7xl md:text-8xl leading-none mr-3 mt-1 text-accent">{p[0]}</span>}
                    {i === 0 ? p.slice(1) : p}
                  </p>
                ))}
              </div>
              <aside className="md:col-span-4 md:pt-4">
                <blockquote className="border-l-2 border-accent pl-6 mb-12">
                  <p className="text-2xl md:text-3xl italic font-light leading-snug">
                    {strategy.storytelling.pullQuote}
                  </p>
                </blockquote>
                <div className="space-y-6 text-sm bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                  <div>
                    <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-2">Ce qu'on raconte</div>
                    <div className="font-serif text-base font-light italic">{strategy.storytelling.proof.tells}</div>
                  </div>
                  <div>
                    <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-2">Ce que ça prouve</div>
                    <div className="font-serif text-base font-light italic">{strategy.storytelling.proof.proves}</div>
                  </div>
                  <div>
                    <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-2">Où l'utiliser</div>
                    <div className="font-serif text-base font-light italic">{strategy.storytelling.proof.useFor}</div>
                  </div>
                </div>
              </aside>
            </div>
          </section>

          <Divider />

          {/* 05 — Piliers */}
          <section>
            <SectionLabel number="05" title="Les 4 piliers" />
            <div className="grid md:grid-cols-2 gap-px bg-foreground/10 border border-foreground/10">
              {strategy.pillars.map((pillar, i) => (
                <div key={i} className="bg-background p-10 md:p-14 group hover:bg-accent/5 transition-colors">
                  <div className="text-xs tracking-[0.3em] uppercase text-accent mb-6 bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                    0{i + 1}
                  </div>
                  <h3 className="text-3xl md:text-4xl italic font-light mb-4">{pillar.name}</h3>
                  <p className="text-lg font-light text-muted-foreground leading-relaxed">{pillar.description}</p>
                </div>
              ))}
            </div>
          </section>

          <Divider />

          {/* 06 — Moments signature */}
          <section>
            <SectionLabel number="06" title="Les 3 moments signature" />
            <div className="space-y-24">
              {strategy.signatureMoments.map((moment) => (
                <article key={moment.index} className="grid md:grid-cols-12 gap-8 md:gap-12">
                  <div className="md:col-span-3">
                    <div className="text-7xl md:text-8xl italic font-light text-accent leading-none mb-4">
                      {moment.index}
                    </div>
                    <div className="text-xs tracking-[0.3em] uppercase text-muted-foreground bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                      {moment.when}
                    </div>
                  </div>
                  <div className="md:col-span-9 space-y-8">
                    <div>
                      <h3 className="text-3xl md:text-5xl italic font-light leading-tight mb-4">
                        {moment.title}
                      </h3>
                      <p className="text-xl font-light text-muted-foreground italic">{moment.intro}</p>
                    </div>

                    <blockquote className="text-2xl md:text-3xl italic font-light leading-snug border-l-2 border-accent pl-6 my-8">
                      {moment.quote}
                    </blockquote>

                    <div className="grid md:grid-cols-3 gap-8 pt-4 border-t border-foreground/10">
                      <div>
                        <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3 bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                          Ce que le client vit
                        </div>
                        <p className="text-base font-light leading-relaxed">{moment.lives}</p>
                      </div>
                      <div>
                        <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3 bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                          Ce qu'il raconte
                        </div>
                        <p className="text-base font-light italic leading-relaxed">{moment.tells}</p>
                      </div>
                      <div>
                        <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3 bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                          Rôle stratégique
                        </div>
                        <p className="text-base font-light leading-relaxed">{moment.role}</p>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <Divider />

          {/* 07 — Voix de marque */}
          <section>
            <SectionLabel number="07" title="Voix de marque" />
            <div className="grid md:grid-cols-2 gap-16">
              <div>
                <div className="text-xs tracking-[0.3em] uppercase text-accent mb-8 bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                  La marque est
                </div>
                <ul className="space-y-3">
                  {strategy.voice.is.map((v) => (
                    <li key={v} className="text-3xl md:text-4xl italic font-light">
                      {v}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-8 bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                  Ce qu'on refuse d'être
                </div>
                <ul className="space-y-3">
                  {strategy.voice.isNot.map((v) => (
                    <li key={v} className="text-2xl md:text-3xl font-light text-muted-foreground line-through decoration-accent/40 decoration-1">
                      {v}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <Divider />

          {/* 08 — SWOT */}
          <section>
            <SectionLabel number="08" title="SWOT" />
            <div className="grid md:grid-cols-2 gap-px bg-foreground/10 border border-foreground/10">
              {[
                { label: "Forces", items: strategy.swot.strengths, accent: true },
                { label: "Faiblesses", items: strategy.swot.weaknesses, accent: false },
                { label: "Opportunités", items: strategy.swot.opportunities, accent: true },
                { label: "Menaces", items: strategy.swot.threats, accent: false },
              ].map((block) => (
                <div key={block.label} className="bg-background p-8 md:p-12">
                  <div className={`text-xs tracking-[0.3em] uppercase mb-8 bs-mono ${block.accent ? "text-accent" : "text-muted-foreground"}`} style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                    {block.label}
                  </div>
                  <ul className="space-y-6">
                    {block.items.map((item, i) => (
                      <li key={i}>
                        <div className="text-xl font-light italic mb-1">{item.title}</div>
                        <div className="text-sm text-muted-foreground leading-relaxed">{item.detail}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <Divider />

          {/* 09 — Naming */}
          <section>
            <SectionLabel number="09" title="Naming (en cours)" />
            <p className="text-xl md:text-2xl font-light italic text-muted-foreground mb-16">
              {strategy.naming.intro}
            </p>
            <div className="space-y-20">
              {strategy.naming.strategies.map((s) => (
                <div key={s.code}>
                  <div className="flex items-baseline gap-6 mb-4">
                    <span className="text-6xl md:text-7xl italic font-light text-accent leading-none">{s.code}</span>
                    <h3 className="text-2xl md:text-4xl italic font-light">{s.title}</h3>
                  </div>
                  <p className="text-lg font-light text-muted-foreground max-w-3xl mb-12 leading-relaxed">
                    {s.description}
                  </p>
                  <div className="grid md:grid-cols-3 gap-8 mb-10">
                    {s.directions.map((d) => (
                      <div key={d.name} className="border-t border-foreground/20 pt-6">
                        <h4 className="text-2xl md:text-3xl italic font-light mb-6">{d.name}</h4>
                        <ul className="space-y-3">
                          {d.signatures.map((sig) => (
                            <li key={sig} className="text-base font-light italic text-muted-foreground border-l border-accent/40 pl-4">
                              {sig}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3 bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                    Pistes explorées
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-light text-muted-foreground italic">
                    {s.explorations.map((e, i) => (
                      <span key={e}>
                        {e}
                        {i < s.explorations.length - 1 && <span className="text-foreground/20 ml-4">·</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <Divider />

          {/* 10 — À construire */}
          <section className="pb-16">
            <SectionLabel number="10" title="À construire prochainement" />
            <ul className="space-y-4 max-w-3xl">
              {strategy.todo.map((t, i) => (
                <li key={t} className="flex gap-6 items-baseline border-b border-foreground/10 pb-4">
                  <span className="text-xs text-muted-foreground bs-mono w-8" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-xl md:text-2xl font-light italic flex-1">{t}</span>
                  <span className="h-3 w-3 border border-foreground/30" />
                </li>
              ))}
            </ul>
          </section>

          {/* 11 — Territoire visuel */}
          {strategy.visualTerritory && (strategy.visualTerritory.intro || strategy.visualTerritory.keywords.length > 0 || strategy.visualTerritory.references.length > 0 || strategy.visualTerritory.notes) && (
            <>
              <Divider />
              <section>
                <SectionLabel number="11" title="Territoire visuel" />
                {strategy.visualTerritory.intro && (
                  <p className="text-2xl md:text-3xl font-light italic max-w-4xl mb-12 leading-relaxed">
                    {strategy.visualTerritory.intro}
                  </p>
                )}
                <div className="grid md:grid-cols-2 gap-12">
                  {strategy.visualTerritory.keywords.length > 0 && (
                    <div>
                      <div className="text-xs tracking-[0.3em] uppercase text-accent mb-6 bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                        Mots-clés
                      </div>
                      <ul className="space-y-2">
                        {strategy.visualTerritory.keywords.map((k) => (
                          <li key={k} className="text-2xl md:text-3xl italic font-light">{k}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {strategy.visualTerritory.references.length > 0 && (
                    <div>
                      <div className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-6 bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                        Références
                      </div>
                      <ul className="space-y-2">
                        {strategy.visualTerritory.references.map((r) => (
                          <li key={r} className="text-lg font-light text-muted-foreground italic border-l border-accent/40 pl-4">
                            {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                {strategy.visualTerritory.notes && (
                  <p className="mt-12 text-lg font-light leading-relaxed text-muted-foreground max-w-4xl">
                    {strategy.visualTerritory.notes}
                  </p>
                )}
              </section>
            </>
          )}

          {/* 12 — Persona */}
          {strategy.persona && (strategy.persona.intro || strategy.persona.profiles.length > 0) && (
            <>
              <Divider />
              <section>
                <SectionLabel number="12" title="Persona affiné" />
                {strategy.persona.intro && (
                  <p className="text-xl md:text-2xl font-light italic text-muted-foreground max-w-4xl mb-16">
                    {strategy.persona.intro}
                  </p>
                )}
                <div className="space-y-20">
                  {strategy.persona.profiles.map((p, i) => (
                    <article key={i} className="grid md:grid-cols-12 gap-8 md:gap-12">
                      <div className="md:col-span-3">
                        <div className="text-5xl md:text-6xl italic font-light text-accent leading-none mb-3">
                          {p.firstName}
                        </div>
                        <div className="text-xs tracking-[0.3em] uppercase text-muted-foreground bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                          {[p.age, p.role].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <div className="md:col-span-9 space-y-6">
                        {p.bio && <p className="text-xl md:text-2xl font-light leading-relaxed">{p.bio}</p>}
                        {p.quote && (
                          <blockquote className="text-2xl md:text-3xl italic font-light leading-snug border-l-2 border-accent pl-6">
                            « {p.quote} »
                          </blockquote>
                        )}
                        <div className="grid md:grid-cols-2 gap-8 pt-4 border-t border-foreground/10">
                          {p.lifestyle && (
                            <div>
                              <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3 bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                                Mode de vie
                              </div>
                              <p className="text-base font-light leading-relaxed">{p.lifestyle}</p>
                            </div>
                          )}
                          {p.needs && (
                            <div>
                              <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3 bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                                Attentes & besoins
                              </div>
                              <p className="text-base font-light leading-relaxed">{p.needs}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* 13 — Plan de communication */}
          {strategy.launchPlan && (strategy.launchPlan.intro || strategy.launchPlan.phases.length > 0) && (
            <>
              <Divider />
              <section>
                <SectionLabel number="13" title="Plan de communication — lancement" />
                {strategy.launchPlan.intro && (
                  <p className="text-xl md:text-2xl font-light italic text-muted-foreground max-w-4xl mb-16">
                    {strategy.launchPlan.intro}
                  </p>
                )}
                <div className="space-y-16">
                  {strategy.launchPlan.phases.map((ph, i) => (
                    <article key={i} className="grid md:grid-cols-12 gap-8">
                      <div className="md:col-span-3">
                        <div className="text-6xl italic font-light text-accent leading-none mb-3">
                          {String(i + 1).padStart(2, "0")}
                        </div>
                        <div className="text-xs tracking-[0.3em] uppercase text-muted-foreground bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                          {ph.timing}
                        </div>
                      </div>
                      <div className="md:col-span-9 space-y-6">
                        <h3 className="text-3xl md:text-4xl italic font-light">{ph.title}</h3>
                        {ph.objective && <p className="text-lg font-light italic text-muted-foreground">{ph.objective}</p>}
                        <div className="grid md:grid-cols-2 gap-8 pt-4 border-t border-foreground/10">
                          {ph.actions.length > 0 && (
                            <div>
                              <div className="text-[10px] tracking-[0.3em] uppercase text-accent mb-3 bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>Actions</div>
                              <ul className="space-y-2">
                                {ph.actions.map((a) => (
                                  <li key={a} className="text-base font-light leading-relaxed">— {a}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {ph.channels.length > 0 && (
                            <div>
                              <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3 bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>Canaux</div>
                              <ul className="space-y-2">
                                {ph.channels.map((c) => (
                                  <li key={c} className="text-base font-light italic leading-relaxed">{c}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* 14 — Moodboard */}
          {strategy.moodboard && (strategy.moodboard.intro || strategy.moodboard.universes.length > 0) && (
            <>
              <Divider />
              <section>
                <SectionLabel number="14" title="Moodboard — univers à explorer" />
                {strategy.moodboard.intro && (
                  <p className="text-xl md:text-2xl font-light italic text-muted-foreground max-w-4xl mb-16">
                    {strategy.moodboard.intro}
                  </p>
                )}
                <div className="grid md:grid-cols-2 gap-px bg-foreground/10 border border-foreground/10">
                  {strategy.moodboard.universes.map((u, i) => (
                    <div key={i} className="bg-background p-10 md:p-14">
                      <div className="text-xs tracking-[0.3em] uppercase text-accent mb-6 bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                        Univers 0{i + 1}
                      </div>
                      <h3 className="text-3xl md:text-4xl italic font-light mb-4">{u.name}</h3>
                      <p className="text-lg font-light text-muted-foreground leading-relaxed mb-6">{u.description}</p>
                      {u.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-base font-light italic mb-6">
                          {u.keywords.map((k, j) => (
                            <span key={k}>
                              {k}
                              {j < u.keywords.length - 1 && <span className="text-foreground/20 ml-4">·</span>}
                            </span>
                          ))}
                        </div>
                      )}
                      {u.references.length > 0 && (
                        <ul className="space-y-2">
                          {u.references.map((r) => (
                            <li key={r} className="text-sm font-light text-muted-foreground italic border-l border-accent/40 pl-4">
                              {r}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* 15 — Système de logos */}
          {strategy.logoSystem && (strategy.logoSystem.intro || strategy.logoSystem.items.length > 0) && (
            <>
              <Divider />
              <section>
                <SectionLabel number="15" title="Système de logos" />
                {strategy.logoSystem.intro && (
                  <p className="text-xl md:text-2xl font-light italic text-muted-foreground max-w-4xl mb-16">
                    {strategy.logoSystem.intro}
                  </p>
                )}
                <div className="grid md:grid-cols-3 gap-px bg-foreground/10 border border-foreground/10">
                  {strategy.logoSystem.items.map((it, i) => (
                    <div key={i} className="bg-background p-8 md:p-10">
                      <div className="text-xs tracking-[0.3em] uppercase text-accent mb-4 bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                        {it.type}
                      </div>
                      <h3 className="text-2xl md:text-3xl italic font-light mb-3">{it.name}</h3>
                      {it.usage && <div className="text-sm font-light text-muted-foreground italic mb-3">{it.usage}</div>}
                      {it.description && <p className="text-base font-light leading-relaxed">{it.description}</p>}
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* 16 — Typographie */}
          {strategy.typography && (strategy.typography.intro || strategy.typography.fonts.length > 0) && (
            <>
              <Divider />
              <section>
                <SectionLabel number="16" title="Système typographique" />
                {strategy.typography.intro && (
                  <p className="text-xl md:text-2xl font-light italic text-muted-foreground max-w-4xl mb-16">
                    {strategy.typography.intro}
                  </p>
                )}
                <div className="space-y-12">
                  {strategy.typography.fonts.map((f, i) => (
                    <div key={i} className="grid md:grid-cols-12 gap-8 border-t border-foreground/10 pt-8">
                      <div className="md:col-span-3">
                        <div className="text-xs tracking-[0.3em] uppercase text-accent mb-2 bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                          {f.role}
                        </div>
                        <div className="text-2xl italic font-light">{f.name}</div>
                        {f.usage && <div className="text-sm text-muted-foreground italic mt-2">{f.usage}</div>}
                      </div>
                      <div className="md:col-span-9">
                        <p className="text-4xl md:text-6xl font-light leading-tight" style={{ fontFamily: f.name }}>
                          {f.sample || "Aa Bb Cc — 0123"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* 17 — Palette chromatique */}
          {strategy.colorPalette && (strategy.colorPalette.intro || strategy.colorPalette.primary.length > 0 || strategy.colorPalette.neutrals.length > 0) && (
            <>
              <Divider />
              <section>
                <SectionLabel number="17" title="Palette chromatique" />
                {strategy.colorPalette.intro && (
                  <p className="text-xl md:text-2xl font-light italic text-muted-foreground max-w-4xl mb-16">
                    {strategy.colorPalette.intro}
                  </p>
                )}
                {strategy.colorPalette.primary.length > 0 && (
                  <div className="mb-16">
                    <div className="text-xs tracking-[0.3em] uppercase text-accent mb-6 bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                      Couleurs primaires
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-foreground/10 border border-foreground/10">
                      {strategy.colorPalette.primary.map((c, i) => (
                        <div key={i} className="bg-background">
                          <div className="aspect-[4/3]" style={{ backgroundColor: c.hex }} />
                          <div className="p-5">
                            <div className="text-lg italic font-light">{c.name}</div>
                            <div className="text-xs text-muted-foreground bs-mono mt-1" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                              {c.hex}
                            </div>
                            {c.usage && <div className="text-sm font-light text-muted-foreground italic mt-2">{c.usage}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {strategy.colorPalette.neutrals.length > 0 && (
                  <div>
                    <div className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-6 bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                      Neutres
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-foreground/10 border border-foreground/10">
                      {strategy.colorPalette.neutrals.map((c, i) => (
                        <div key={i} className="bg-background">
                          <div className="aspect-square" style={{ backgroundColor: c.hex }} />
                          <div className="p-4">
                            <div className="text-base italic font-light">{c.name}</div>
                            <div className="text-[10px] text-muted-foreground bs-mono mt-1" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                              {c.hex}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </>
          )}

          {/* 18 — In situ */}
          {strategy.inSitu && (strategy.inSitu.intro || strategy.inSitu.items.length > 0) && (
            <>
              <Divider />
              <section>
                <SectionLabel number="18" title="Mises en situation — in situ" />
                {strategy.inSitu.intro && (
                  <p className="text-xl md:text-2xl font-light italic text-muted-foreground max-w-4xl mb-16">
                    {strategy.inSitu.intro}
                  </p>
                )}
                <div className="space-y-16">
                  {strategy.inSitu.items.map((it, i) => (
                    <article key={i} className="grid md:grid-cols-12 gap-8 border-t border-foreground/10 pt-12">
                      <div className="md:col-span-3">
                        <div className="text-5xl italic font-light text-accent leading-none mb-3">
                          {String(i + 1).padStart(2, "0")}
                        </div>
                        <div className="text-xs tracking-[0.3em] uppercase text-muted-foreground bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                          {it.context}
                        </div>
                      </div>
                      <div className="md:col-span-9 space-y-4">
                        <h3 className="text-3xl md:text-4xl italic font-light">{it.title}</h3>
                        <p className="text-lg font-light leading-relaxed text-muted-foreground">{it.description}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}

          <footer className="pt-16 mt-16 border-t border-foreground/10 flex justify-between text-xs tracking-widest uppercase text-muted-foreground bs-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
            <span>{strategy.client}</span>
            <span>{strategy.version}</span>
          </footer>
        </div>
      </div>
    </div>
  );
}
