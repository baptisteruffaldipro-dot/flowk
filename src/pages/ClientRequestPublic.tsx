import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, Clock, FileText, Download, Send } from "lucide-react";
import { toast } from "sonner";
import { computeTaskBilling } from "@/lib/billing";

const PRESTATION_LABEL: Record<string, string> = {
  logo: "Logo", refonte: "Refonte", ajustements: "Ajustements",
  conception_graphique: "Conception graphique", illustration: "Illustration",
  impression: "Impression", autre: "Autre",
};
const STATUS_LABEL: Record<string, string> = {
  nouveau: "En attente de votre validation",
  en_attente_client: "En attente de votre validation",
  validee: "Validée",
  refusee: "Refusée",
  convertie: "En cours",
  annulee: "Annulée",
};

export default function ClientRequestPublic() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState("");
  const [refuseReason, setRefuseReason] = useState("");
  const [showRefuse, setShowRefuse] = useState(false);

  const reload = async () => {
    if (!token) return;
    const { data: d, error } = await supabase.rpc("get_client_request_by_token" as any, { _token: token });
    if (error || !d) { setError("Demande introuvable ou archivée."); return; }
    setData(d);
  };
  useEffect(() => { reload(); }, [token]);

  if (error) return <div className="min-h-screen flex items-center justify-center text-muted-foreground p-8 text-center">{error}</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Chargement…</div>;

  const r = data.request;
  const messages = data.messages || [];
  const project = data.project;
  const task = data.task;
  const printOrder = data.print_order;
  const invoices = data.invoices || [];

  const decide = async (decision: "valider" | "refuser") => {
    setBusy(true);
    const { error } = await supabase.rpc("client_request_decide_by_token" as any, {
      _token: token, _decision: decision, _reason: decision === "refuser" ? refuseReason : null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(decision === "valider" ? "Demande validée" : "Demande refusée");
    setShowRefuse(false);
    setRefuseReason("");
    reload();
  };

  const sendReply = async () => {
    if (!reply.trim()) return;
    const { error } = await supabase.rpc("client_request_add_message_by_token" as any, {
      _token: token, _body: reply.trim(),
    });
    if (error) return toast.error(error.message);
    setReply("");
    toast.success("Message envoyé");
    reload();
  };

  // Avancement
  let progress = 0;
  let progressLabel = "";
  if (r.status === "validee") progress = 25;
  if (r.status === "convertie") progress = 40;
  if (task) {
    const t = task as any;
    if (t.status === "en_cours") progress = Math.max(progress, 50);
    if (t.status === "en_revision" || t.status === "en_validation") progress = Math.max(progress, 75);
    if (t.status === "termine") progress = 100;
    progressLabel = t.status?.replace(/_/g, " ") || "";
  }
  if (project) {
    progressLabel = (project as any).status || progressLabel;
  }
  if (r.status === "refusee" || r.status === "annulee") progress = 0;

  // Temps & dépassement
  let timeBlock: { used: number; estimated: number; overrun: number; isFlat: boolean } | null = null;
  if (task) {
    const t = task as any;
    timeBlock = {
      used: t.total_minutes ?? 0,
      estimated: t.estimated_minutes ?? r.estimated_minutes ?? 0,
      overrun: Math.max(0, (t.total_minutes ?? 0) - (t.estimated_minutes ?? r.estimated_minutes ?? 0)),
      isFlat: (t.billing_type ?? r.billing_type) === "forfait",
    };
  } else if (r.estimated_minutes) {
    timeBlock = { used: 0, estimated: r.estimated_minutes, overrun: 0, isFlat: r.billing_type === "forfait" };
  }

  // Coût actuel
  let currentTotal: number | null = null;
  if (task) {
    const b = computeTaskBilling(task as any);
    currentTotal = b.total;
  } else if (r.estimated_amount) {
    currentTotal = Number(r.estimated_amount);
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <header className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {r.prestation_type && (
              <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-muted text-muted-foreground">
                {PRESTATION_LABEL[r.prestation_type] ?? r.prestation_type}
              </span>
            )}
            <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-secondary text-foreground">
              {STATUS_LABEL[r.status] ?? r.status}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{r.title}</h1>
          {r.client_name_snapshot && (
            <div className="text-sm text-muted-foreground">Pour {r.client_name_snapshot}</div>
          )}
        </header>

        {/* Récap */}
        <section className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Récapitulatif</h2>
          {r.description && <p className="text-sm whitespace-pre-wrap">{r.description}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <Info label="Facturation" value={
              r.billing_type === "forfait" ? "Forfait" :
              r.billing_type === "horaire" ? "Au temps passé" : "À définir"
            } />
            {r.estimated_amount != null && (
              <Info label="Montant estimé" value={`${Number(r.estimated_amount).toFixed(2)} €`} />
            )}
            {r.estimated_minutes != null && (
              <Info label="Temps estimé" value={`${Math.round((r.estimated_minutes/60)*10)/10} h`} />
            )}
            {r.hourly_rate != null && (
              <Info label="Taux horaire" value={`${Number(r.hourly_rate).toFixed(2)} €`} />
            )}
            {r.deadline && (
              <Info label="Échéance" value={new Date(r.deadline).toLocaleDateString("fr-FR")} />
            )}
          </div>
        </section>

        {/* Validation */}
        {(r.status === "nouveau" || r.status === "en_attente_client") && (
          <section className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-3">
            <h2 className="text-sm font-semibold">Votre validation</h2>
            <p className="text-sm text-muted-foreground">
              Confirmez la demande pour que nous démarrions. Vous pourrez suivre l’avancement et accéder aux factures sur cette page.
            </p>
            {showRefuse ? (
              <div className="space-y-2">
                <Textarea
                  placeholder="Motif (optionnel)" value={refuseReason}
                  onChange={(e) => setRefuseReason(e.target.value)} rows={2}
                />
                <div className="flex gap-2">
                  <Button variant="destructive" onClick={() => decide("refuser")} disabled={busy}>Confirmer le refus</Button>
                  <Button variant="ghost" onClick={() => setShowRefuse(false)}>Annuler</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={() => decide("valider")} disabled={busy}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Valider la demande
                  </Button>
                  <Button variant="outline" onClick={() => setShowRefuse(true)} disabled={busy}>
                    <XCircle className="h-4 w-4 mr-1" /> Refuser
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  En validant cette demande, vous acceptez les conditions : toute demande validée est ferme et engage une facturation selon le devis ou l’estimation communiqué(e). Aucun travail ne sera engagé sans cette validation préalable.
                </p>
              </div>
            )}
          </section>
        )}

        {/* Avancement */}
        {(progress > 0 || progressLabel) && (
          <section className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Avancement</h2>
            <Progress value={progress} />
            <div className="text-sm text-muted-foreground capitalize">
              {progressLabel || `${progress}%`} {progress > 0 && `· ${progress}%`}
            </div>
          </section>
        )}

        {/* Temps */}
        {timeBlock && (timeBlock.estimated > 0 || timeBlock.used > 0) && (
          <section className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <Clock className="h-3.5 w-3.5 inline-block mr-1" /> Temps passé
            </h2>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <Info label="Estimé" value={`${Math.round(timeBlock.estimated/60*10)/10} h`} />
              <Info label="Réalisé" value={`${Math.round(timeBlock.used/60*10)/10} h`} />
              <Info
                label="Dépassement"
                value={timeBlock.overrun > 0 ? `+${Math.round(timeBlock.overrun/60*10)/10} h` : "—"}
                highlight={timeBlock.overrun > 0 && !timeBlock.isFlat}
              />
            </div>
            {timeBlock.overrun > 0 && timeBlock.isFlat && (
              <p className="text-xs text-amber-400">
                Forfait : le temps supplémentaire ne change pas le montant, sauf accord spécifique.
              </p>
            )}
          </section>
        )}

        {/* Frais actuels */}
        {currentTotal != null && (
          <section className="rounded-xl border border-border/60 bg-card p-5 space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Frais</h2>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold">{currentTotal.toFixed(2)} €</span>
              <span className="text-xs text-muted-foreground">total estimé / actuel</span>
            </div>
          </section>
        )}

        {/* Factures */}
        {invoices.length > 0 && (
          <section className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Devis & factures</h2>
            <div className="space-y-2">
              {invoices.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between gap-3 p-3 rounded-md bg-muted/40">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      <FileText className="h-3.5 w-3.5 inline-block mr-1" />
                      {inv.label || inv.number || "Facture"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {inv.amount != null && <>{Number(inv.amount).toFixed(2)} €</>}
                      {inv.status && <> · {inv.status}</>}
                    </div>
                  </div>
                  {inv.pdf_url && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={inv.pdf_url} target="_blank" rel="noreferrer">
                        <Download className="h-3.5 w-3.5 mr-1" /> PDF
                      </a>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Livrables si commande/print */}
        {printOrder && (
          <section className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Commande</h2>
            <div className="text-sm">{printOrder.description || "—"}</div>
            {printOrder.estimated_delivery_date && (
              <div className="text-xs text-muted-foreground">
                Livraison estimée : {new Date(printOrder.estimated_delivery_date).toLocaleDateString("fr-FR")}
              </div>
            )}
          </section>
        )}

        {/* Échanges */}
        <section className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Échanges</h2>
          {messages.length === 0 ? (
            <div className="text-xs text-muted-foreground">Aucun message pour le moment.</div>
          ) : (
            <div className="space-y-2">
              {messages.map((m: any) => (
                <div key={m.id} className={`text-sm p-3 rounded-md ${m.author === "client" ? "bg-primary/10" : "bg-muted/40"}`}>
                  <div className="text-[10px] uppercase text-muted-foreground mb-0.5">
                    {m.author === "client" ? "Vous" : "Studio"} · {new Date(m.created_at).toLocaleString("fr-FR")}
                  </div>
                  <div className="whitespace-pre-wrap">{m.body}</div>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-2">
            <Textarea
              placeholder="Écrire un message…" value={reply}
              onChange={(e) => setReply(e.target.value)} rows={3}
            />
            <Button onClick={sendReply} disabled={!reply.trim()} size="sm">
              <Send className="h-3.5 w-3.5 mr-1" /> Envoyer
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

function Info({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-medium ${highlight ? "text-amber-400" : ""}`}>{value}</div>
    </div>
  );
}