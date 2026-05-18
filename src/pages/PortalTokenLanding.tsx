import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function PortalTokenLanding() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      try {
        // Sign out any existing session so the token always lands on the right client
        await supabase.auth.signOut();

        const { data, error: fnErr } = await supabase.functions.invoke("portal-token-exchange", {
          body: { token },
        });
        if (fnErr) throw fnErr;
        if (data?.error) throw new Error(data.error);
        if (!data?.token_hash || !data?.email) throw new Error("Réponse invalide du serveur");

        const { error: otpErr } = await supabase.auth.verifyOtp({
          type: "magiclink",
          token_hash: data.token_hash,
        });
        if (otpErr) throw otpErr;

        if (!cancelled) navigate("/portail", { replace: true });
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Lien invalide ou expiré");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="text-center max-w-sm">
        {error ? (
          <>
            <h1 className="text-lg font-semibold mb-2">Lien indisponible</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Ouverture de votre espace…</p>
        )}
      </div>
    </div>
  );
}