import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type State = "loading" | "valid" | "already" | "invalid" | "submitting" | "done" | "error";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`;
    fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } })
      .then(r => r.json())
      .then(d => {
        if (d?.valid) setState("valid");
        else if (d?.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      })
      .catch(() => setState("error"));
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setState("submitting");
    const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
    if (error) { setState("error"); return; }
    if (data?.success || data?.reason === "already_unsubscribed") setState("done");
    else setState("error");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md p-8 text-center">
        {state === "loading" && (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-sm">Vérification du lien…</p>
          </div>
        )}
        {state === "valid" && (
          <>
            <h1 className="text-xl font-semibold mb-2">Se désinscrire</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Confirmez votre désinscription pour ne plus recevoir d'emails de notre part.
            </p>
            <Button onClick={confirm} className="w-full">Confirmer la désinscription</Button>
          </>
        )}
        {state === "submitting" && (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-sm">Traitement…</p>
          </div>
        )}
        {state === "done" && (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <h1 className="text-xl font-semibold">Désinscription confirmée</h1>
            <p className="text-sm text-muted-foreground">Vous ne recevrez plus d'emails.</p>
          </div>
        )}
        {state === "already" && (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
            <h1 className="text-xl font-semibold">Déjà désinscrit</h1>
            <p className="text-sm text-muted-foreground">Cette adresse est déjà désabonnée.</p>
          </div>
        )}
        {(state === "invalid" || state === "error") && (
          <div className="flex flex-col items-center gap-3">
            <XCircle className="h-8 w-8 text-destructive" />
            <h1 className="text-xl font-semibold">Lien invalide</h1>
            <p className="text-sm text-muted-foreground">
              Ce lien de désinscription est invalide ou a expiré.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}