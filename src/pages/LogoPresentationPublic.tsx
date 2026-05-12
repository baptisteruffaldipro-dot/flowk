import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import LogoPresentationView from "@/components/logo-presentation/LogoPresentationView";
import type { LogoPresentation } from "@/data/logo-presentations/types";
import { emptyLogoPresentationContent, emptyTrack, emptyUniverse } from "@/data/logo-presentations/empty";

function migrateLogos(raw: any) {
  const base = emptyLogoPresentationContent.logos;
  const src = raw || {};
  if (Array.isArray(src.tracks) && src.tracks.length > 0) {
    return { tracks: src.tracks.map((t: any, i: number) => ({ ...emptyTrack(`Piste ${i + 1}`), ...t })) };
  }
  // Legacy: single track stored directly on logos
  if (src.primary || src.secondary || src.submark || src.intro) {
    const t0 = emptyTrack("Piste 1");
    return { tracks: [{
      ...t0,
      intro: src.intro || "",
      primary: { ...t0.primary, ...(src.primary || {}) },
      secondary: { ...t0.secondary, ...(src.secondary || {}) },
      submark: { ...t0.submark, ...(src.submark || {}) },
    }] };
  }
  return base;
}

function migrateMoodboard(raw: any) {
  const src = raw || {};
  if (Array.isArray(src.universes) && src.universes.length > 0) {
    return { universes: src.universes.map((u: any, i: number) => ({ ...emptyUniverse(`Univers ${i + 1}`), ...u })) };
  }
  if (src.intro || (Array.isArray(src.keywords) && src.keywords.length) || (Array.isArray(src.images) && src.images.length)) {
    return { universes: [{ ...emptyUniverse("Univers 1"), intro: src.intro || "", keywords: src.keywords || [], images: src.images || [] }] };
  }
  return { universes: [emptyUniverse("Univers 1")] };
}

export default function LogoPresentationPublic() {
  const { token } = useParams<{ token: string }>();
  const [presentation, setPresentation] = useState<LogoPresentation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    supabase.rpc("get_logo_presentation_by_token" as any, { _token: token }).then(({ data, error: err }) => {
      if (err || !data) { setError("Présentation introuvable ou non publiée."); return; }
      const row: any = Array.isArray(data) ? data[0] : data;
      if (!row) { setError("Présentation introuvable ou non publiée."); return; }
      const content = row.content || {};
      setPresentation({
        slug: row.id,
        client: row.client_name,
        projectName: row.project_name,
        version: row.version,
        tagline: row.tagline,
        ...emptyLogoPresentationContent,
        ...content,
        brief: { ...emptyLogoPresentationContent.brief, ...(content.brief || {}) },
        moodboard: migrateMoodboard(content.moodboard),
        logos: migrateLogos(content.logos),
        colors: { ...emptyLogoPresentationContent.colors, ...(content.colors || {}) },
        typography: { ...emptyLogoPresentationContent.typography, ...(content.typography || {}) },
        inSitu: { ...emptyLogoPresentationContent.inSitu, ...(content.inSitu || {}) },
      });
    });
  }, [token]);

  if (error) return <div className="min-h-screen flex items-center justify-center text-muted-foreground p-8 text-center">{error}</div>;
  if (!presentation) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Chargement…</div>;
  return <LogoPresentationView presentation={presentation} />;
}