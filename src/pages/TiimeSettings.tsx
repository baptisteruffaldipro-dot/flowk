import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import { getFunctionErrorMessage } from "@/lib/function-errors";

export default function TiimeSettings() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{
    hasToken: boolean;
    updatedAt: string | null;
    expiresAt: string | null;
  }>({ hasToken: false, updatedAt: null, expiresAt: null });
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [verifyResult, setVerifyResult] = useState<
    { ok: true; companies: number } | { ok: false; error: string } | null
  >(null);

  const loadStatus = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tiime_auth" as any)
      .select("refresh_token, access_token_expires_at, updated_at")
      .eq("id", 1)
      .maybeSingle();
    if (error) toast.error(error.message);
    const row = data as any;
    setStatus({
      hasToken: !!row?.refresh_token,
      updatedAt: row?.updated_at ?? null,
      expiresAt: row?.access_token_expires_at ?? null,
    });
    setLoading(false);
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const save = async () => {
    if (!token.trim()) return toast.error("Colle un refresh_token");
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "tiime-create-invoice",
        { body: { action: "save_refresh_token", refresh_token: token.trim() } },
      );
      if (error || (data as any)?.error) {
        toast.error(await getFunctionErrorMessage(error, data, "Échec de l'enregistrement"));
        return;
      }
      toast.success("Refresh token enregistré");
      setToken("");
      await loadStatus();
    } finally {
      setSaving(false);
    }
  };

  const verify = async () => {
    setTesting(true);
    setVerifyResult(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "tiime-create-invoice",
        { body: { action: "verify" } },
      );
      if (error || (data as any)?.error) {
        const msg = await getFunctionErrorMessage(error, data, "Échec du test");
        setVerifyResult({ ok: false, error: msg });
        return;
      }
      const companies = Number((data as any)?.companies ?? 0);
      setVerifyResult({ ok: true, companies });
      toast.success(`Connexion OK — ${companies} société${companies > 1 ? "s" : ""}`);
      await loadStatus();
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <PageHeader title="Connexion Tiime" description="Permet de créer des factures brouillon dans Tiime depuis Flowk." />

      <Card className="p-5 space-y-4 mb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-sm font-medium">État de la connexion</div>
            <div className="text-xs text-muted-foreground">
              {loading
                ? "Chargement…"
                : status.hasToken
                ? `Refresh token enregistré · mis à jour le ${new Date(status.updatedAt!).toLocaleString("fr-FR")}`
                : "Aucun refresh token enregistré"}
            </div>
          </div>
          {!loading &&
            (status.hasToken ? (
              <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Connecté
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-400 text-amber-600">
                <AlertCircle className="h-3.5 w-3.5 mr-1" /> Non configuré
              </Badge>
            ))}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={verify} disabled={testing || !status.hasToken} variant="outline" size="sm">
            {testing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
            Tester la connexion
          </Button>
          {verifyResult?.ok === true && (
            <span className="text-xs text-emerald-600">
              ✓ {verifyResult.companies} société{verifyResult.companies > 1 ? "s" : ""} accessible{verifyResult.companies > 1 ? "s" : ""}
            </span>
          )}
          {verifyResult?.ok === false && (
            <span className="text-xs text-destructive">✗ {verifyResult.error}</span>
          )}
        </div>
      </Card>

      <Card className="p-5 space-y-4 mb-6">
        <div>
          <Label className="text-sm font-medium">Coller un nouveau refresh_token</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Remplace l'ancien token. Utile au premier setup ou si la connexion a expiré.
          </p>
        </div>
        <Textarea
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="v1.MR..."
          rows={4}
          className="font-mono text-xs"
        />
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving || !token.trim()}>
            {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
            Enregistrer
          </Button>
        </div>
      </Card>

      <Card className="p-5 space-y-3 bg-secondary/30">
        <div className="text-sm font-medium">Comment récupérer le refresh_token ?</div>
        <ol className="text-xs text-muted-foreground space-y-2 list-decimal pl-5">
          <li>
            Ouvre{" "}
            <a
              href="https://apps.tiime.fr"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-0.5"
            >
              apps.tiime.fr <ExternalLink className="h-3 w-3" />
            </a>{" "}
            et connecte-toi (avec la double authentification).
          </li>
          <li>
            Une fois connecté, ouvre la console développeur (<kbd>F12</kbd> ou{" "}
            <kbd>Cmd+Option+I</kbd>).
          </li>
          <li>
            Onglet <strong>Application</strong> (Chrome) ou <strong>Storage</strong>{" "}
            (Firefox) → <strong>Local Storage</strong> →{" "}
            <code className="bg-background px-1 rounded">https://apps.tiime.fr</code>.
          </li>
          <li>
            Cherche la clé qui commence par{" "}
            <code className="bg-background px-1 rounded">
              @@auth0spajs@@::iEbsbe3o66gcTBfGRa012kj1Rb6vjAND
            </code>.
          </li>
          <li>
            Dans la valeur (JSON), copie la chaîne contenue dans{" "}
            <code className="bg-background px-1 rounded">body.refresh_token</code>{" "}
            (commence souvent par <code>v1.MR</code>…).
          </li>
          <li>Colle-la ci-dessus et clique sur <strong>Enregistrer</strong>.</li>
        </ol>
        <div className="text-xs text-muted-foreground pt-2 border-t">
          Le token se renouvelle automatiquement à chaque facture créée. Si tu changes
          ton mot de passe Tiime ou si tu n'utilises pas l'intégration pendant ~30
          jours, refais la capture.
        </div>
      </Card>
    </div>
  );
}
