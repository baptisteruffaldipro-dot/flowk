import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/** Résout /portails/:id (lien des notifications) vers la fiche tâche ou projet. */
export default function PortalRedirect() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase
        .from("client_portals")
        .select("entity_type,entity_id")
        .eq("id", id)
        .maybeSingle();
      if (!data) return navigate("/", { replace: true });
      navigate(data.entity_type === "project" ? `/projets/${data.entity_id}` : `/taches/${data.entity_id}`, {
        replace: true,
      });
    })();
  }, [id, navigate]);

  return <div className="p-10 text-sm text-muted-foreground">Ouverture du portail…</div>;
}