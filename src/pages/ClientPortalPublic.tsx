import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Copy, Lock, Send, ExternalLink, CreditCard, Landmark, Download, FileText, Printer, Eye } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABEL: Record<string, string> = {
  draft: "En préparation",
  awaiting_validation: "En attente de votre validation",
  validated: "Validé",
  refused: "Refusé",
  payment_pending: "Paiement en attente",
  payment_link_requested: "Lien de paiement en cours d'envoi",
  paid: "Payé",
  delivered: "Livré",
};

export default function ClientPortalPublic() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [deliv, setDeliv] = useState<{ unlocked: boolean; files: any[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState("");
  const [refuseReason, setRefuseReason] = useState("");
  const [showRefuse, setShowRefuse] = useState(false);
  const [paidNote, setPaidNote] = useState("");
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [obs, setObs] = useState<Record<string, string>>({});

  const load = async () => {
    if (!token) return;
    const { data: d } = await supabase.rpc("get_client_portal_by_token" as any, { _token: token });
    if (!d) { setErr("Portail introuvable ou non publié."); return; }
    setData(d);
    const { data: dl } = await supabase.rpc("portal_deliverables_by_token" as any, { _token: token });
    setDeliv(dl as any);
  };
  useEffect(() => { load(); }, [token]);

  const act = async (action: string, payload: any = {}) => {
    setBusy(true);
    const { error } = await supabase.rpc("portal_action_by_token" as any, { _token: token, _action: action, _payload: payload });
    setBusy(false);
    if (error) return toast.error(error.message);
    await load();
  };

  if (err) return <div className="min-h-screen flex items-center justify-center text-muted-foreground p-8 text-center">{err}</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Chargement…</div>;

  const p = data.portal;
  const entity = data.entity ?? {};
  const client = data.client;
  const messages: any[] = data.messages ?? [];
  const subtasks: any[] = data.subtasks ?? [];
  const invoices: any[] = data.invoices ?? [];
  const pay = data.payment_settings ?? {};
  const printOrder = data.print_order ?? null;
  const invoiceDoc = data.invoice_doc ?? {};
  const reviews: any[] = deliv?.reviews ?? [];
  const methods: string[] = p.payment_methods ?? ["link", "transfer"];
  const amountDue = p.amount_due_ttc != null ? Number(p.amount_due_ttc) : null;
  const termsLabel =
    p.payment_terms === "deposit_50"
      ? "Acompte de 50 % à régler"
      : p.payment_terms === "full"
        ? "Solde total à régler"
        : null;
  const dueAmount =
    amountDue != null ? (p.payment_terms === "deposit_50" ? amountDue / 2 : amountDue) : null;

  const openInvoice = async () => {
    if (invoiceDoc?.url) { window.open(invoiceDoc.url, "_blank"); return; }
    const { data: res, error } = await supabase.functions.invoke("portal-invoice-url", { body: { token } });
    if (error || (res as any)?.error) return toast.error("Facture indisponible");
    window.open((res as any).url, "_blank");
  };

  const isTask = p.entity_type === "task";
  const title = isTask ? entity.title : entity.name;

  const canValidate = p.status === "draft" || p.status === "awaiting_validation";
  const canPay = ["validated", "payment_pending", "payment_link_requested"].includes(p.status);
  const declared = !!p.client_declared_paid_at;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        {/* Header */}
        <header className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-muted text-muted-foreground">
              {isTask ? "Tâche" : "Projet"}
            </span>
            <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-secondary">
              {STATUS_LABEL[p.status] ?? p.status}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{title}</h1>
          {client?.name && <div className="text-sm text-muted-foreground">Pour {client.name}</div>}
        </header>

        {/* Brief */}
        {(entity.notes || entity.description) && (
          <section className="rounded-xl border border-border/60 bg-card p-5 space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Brief</h2>
            <p className="text-sm whitespace-pre-wrap">{entity.notes || entity.description}</p>
          </section>
        )}

        {/* Récap */}
        <section className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Récapitulatif</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            {isTask && entity.billing_type && (
              <Info label="Facturation" value={entity.billing_type === "forfait" ? "Forfait" : "Au temps"} />
            )}
            {isTask && entity.flat_amount != null && (
              <Info label="Montant" value={`${Number(entity.flat_amount).toFixed(2)} € HT`} />
            )}
            {isTask && entity.estimated_minutes && (
              <Info label="Temps estimé" value={`${(entity.estimated_minutes / 60).toFixed(1)} h`} />
            )}
            {entity.deadline && (
              <Info label="Échéance" value={new Date(entity.deadline).toLocaleDateString("fr-FR")} />
            )}
            {isTask && (entity.client_revisions_count != null || entity.free_revisions != null) && (
              <Info
                label="Retours envoyés"
                value={
                  entity.free_revisions
                    ? `${entity.client_revisions_count ?? 0} / ${entity.free_revisions} inclus`
                    : `${entity.client_revisions_count ?? 0}`
                }
              />
            )}
          </div>
          {subtasks.length > 0 && (
            <div className="pt-2 space-y-1">
              <div className="text-[10px] uppercase text-muted-foreground">Étapes</div>
              {subtasks.map((s: any) => (
                <div key={s.id} className="flex items-center gap-2 text-sm">
                  <span className={`h-2 w-2 rounded-full ${s.done ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                  <span className={s.done ? "line-through text-muted-foreground" : ""}>{s.title}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Validation */}
        {canValidate && (
          <section className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-3">
            <h2 className="text-sm font-semibold">Validation</h2>
            <p className="text-xs text-muted-foreground">
              En validant, vous confirmez le tarif indiqué.
            </p>
            {showRefuse ? (
              <div className="space-y-2">
                <Textarea placeholder="Motif (optionnel)" value={refuseReason} onChange={(e) => setRefuseReason(e.target.value)} rows={2} />
                <div className="flex gap-2">
                  <Button variant="destructive" onClick={() => act("refuse", { reason: refuseReason })} disabled={busy}>Confirmer le refus</Button>
                  <Button variant="ghost" onClick={() => setShowRefuse(false)}>Annuler</Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                <Button onClick={() => act("validate")} disabled={busy}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Valider
                </Button>
                <Button variant="outline" onClick={() => setShowRefuse(true)} disabled={busy}>
                  <XCircle className="h-4 w-4 mr-1" /> Refuser
                </Button>
                {p.payment_link_url && (
                  <Button variant="secondary" asChild>
                    <a href={p.payment_link_url} target="_blank" rel="noreferrer">
                      <CreditCard className="h-4 w-4 mr-1" /> Payer <ExternalLink className="h-3.5 w-3.5 ml-1" />
                    </a>
                  </Button>
                )}
              </div>
            )}
          </section>
        )}

        {/* Refus affiché */}
        {p.status === "refused" && (
          <section className="rounded-xl border border-rose-500/40 bg-rose-500/5 p-5">
            <div className="text-sm font-medium">Demande refusée</div>
            {p.refusal_reason && <div className="text-sm text-muted-foreground mt-1">Motif : {p.refusal_reason}</div>}
          </section>
        )}

        {/* Paiement */}
        {canPay && (
          <section className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold">Paiement</h2>
            <p className="text-xs text-muted-foreground">
              Le téléchargement final des livrables est débloqué après confirmation du paiement.
            </p>
            {/* Option virement */}
            <div className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium"><Landmark className="h-4 w-4" /> Virement bancaire</div>
              {pay?.iban ? (
                <div className="space-y-1 text-sm">
                  <RibRow label="Titulaire" value={pay.account_holder} />
                  <RibRow label="IBAN" value={pay.iban} copy />
                  <RibRow label="BIC" value={pay.bic} copy />
                  {pay.bank_name && <RibRow label="Banque" value={pay.bank_name} />}
                  {pay.transfer_note && (
                    <div className="text-xs text-muted-foreground pt-1">{pay.transfer_note}</div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">Les coordonnées bancaires vont vous être communiquées.</div>
              )}
              <Button size="sm" variant="outline" onClick={() => act("choose_transfer")} disabled={busy}>
                J'opte pour le virement
              </Button>
            </div>

            {/* Option lien de paiement */}
            <div className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium"><CreditCard className="h-4 w-4" /> Lien de paiement (carte)</div>
              {p.payment_link_url ? (
                <Button size="sm" asChild>
                  <a href={p.payment_link_url} target="_blank" rel="noreferrer">
                    Payer par carte <ExternalLink className="h-3.5 w-3.5 ml-1" />
                  </a>
                </Button>
              ) : (
                <>
                  <div className="text-xs text-muted-foreground">
                    {p.status === "payment_link_requested"
                      ? "Votre demande a bien été enregistrée. Le lien vous sera envoyé rapidement."
                      : "Souhaitez-vous recevoir un lien de paiement par carte ?"}
                  </div>
                  {p.status !== "payment_link_requested" && (
                    <Button size="sm" variant="outline" onClick={() => act("request_payment_link")} disabled={busy}>
                      Demander un lien de paiement
                    </Button>
                  )}
                </>
              )}
            </div>

            {/* Déclaration paiement */}
            {!declared && (
              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="text-sm font-medium">Vous avez payé ?</div>
                <Input placeholder="Référence / date du virement (optionnel)" value={paidNote} onChange={(e) => setPaidNote(e.target.value)} />
                <Button size="sm" onClick={() => act("declare_paid", { note: paidNote })} disabled={busy}>
                  J'ai effectué le paiement
                </Button>
              </div>
            )}
            {declared && !p.admin_confirmed_paid_at && (
              <div className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded p-2">
                Merci ! Nous vérifions la réception du paiement.
              </div>
            )}
          </section>
        )}

        {/* Factures */}
        {invoices.length > 0 && (
          <section className="rounded-xl border border-border/60 bg-card p-5 space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Devis & factures</h2>
            {invoices.map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 p-2.5 rounded-md bg-muted/40 text-sm">
                <span className="truncate">{inv.label || inv.number || "Facture"} — {inv.amount != null ? `${Number(inv.amount).toFixed(2)} € HT` : ""}</span>
                {inv.pdf_url && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={inv.pdf_url} target="_blank" rel="noreferrer"><Download className="h-3.5 w-3.5 mr-1" /> PDF</a>
                  </Button>
                )}
              </div>
            ))}
          </section>
        )}

        {/* Livrables */}
        <section className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Livrables</h2>
            {deliv?.unlocked ? (
              <Badge className="bg-emerald-500 hover:bg-emerald-500 text-[10px]">Déverrouillés</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] gap-1"><Lock className="h-3 w-3" /> Verrouillés</Badge>
            )}
          </div>
          {(!deliv || deliv.files.length === 0) ? (
            <div className="text-xs text-muted-foreground">Aucun livrable pour le moment.</div>
          ) : deliv.unlocked ? (
            <div className="space-y-1">
              {deliv.files.map((f: any, i: number) => (
                <a key={i} href={f.url} target="_blank" rel="noreferrer"
                   className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary/60">
                  <span className="truncate">{f.name}</span>
                  <Download className="h-3.5 w-3.5" />
                </a>
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {deliv.files.map((f: any, i: number) => (
                <div key={i} className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" /> <span className="truncate">{f.name}</span>
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground pt-1">Les fichiers seront téléchargeables après confirmation du paiement.</p>
            </div>
          )}
        </section>

        {/* Messages */}
        <section className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Échanges</h2>
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
            <Textarea placeholder="Écrire un message…" value={reply} onChange={(e) => setReply(e.target.value)} rows={3} />
            <Button size="sm" onClick={async () => { if (!reply.trim()) return; await act("add_message", { body: reply.trim() }); setReply(""); }} disabled={!reply.trim() || busy}>
              <Send className="h-3.5 w-3.5 mr-1" /> Envoyer
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

function RibRow({ label, value, copy }: { label: string; value?: string | null; copy?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground text-xs w-20">{label}</span>
      <span className="flex-1 font-mono text-xs truncate">{value}</span>
      {copy && (
        <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(value); toast.success("Copié"); }}>
          <Copy className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}