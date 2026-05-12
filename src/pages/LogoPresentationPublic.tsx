import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import LogoPresentationView from "@/components/logo-presentation/LogoPresentationView";
import type { LogoPresentation } from "@/data/logo-presentations/types";
import { emptyLogoPresentationContent } from "@/data/logo-presentations/empty";

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
        moodboard: { ...emptyLogoPresentationContent.moodboard, ...(content.moodboard || {}) },
        logos: {
          ...emptyLogoPresentationContent.logos,
          ...(content.logos || {}),
          primary: { ...emptyLogoPresentationContent.logos.primary, ...((content.logos || {}).primary || {}) },
          secondary: { ...emptyLogoPresentationContent.logos.secondary, ...((content.logos || {}).secondary || {}) },
          submark: { ...emptyLogoPresentationContent.logos.submark, ...((content.logos || {}).submark || {}) },
        },
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