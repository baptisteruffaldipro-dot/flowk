import PdfCanvasViewer from "@/components/PdfCanvasViewer";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, Copy, Lock, Send, ExternalLink, Download, FileText, Printer, Eye, CreditCard, Landmark, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { toast } from "sonner";
import { computeTaskBilling } from "@/lib/billing";

import { Checkbox } from "@/components/ui/checkbox";

type PriceTier = { quantity?: number | null; models?: number | null; price?: number | null };

const BAT_CHECKS = [
  "Textes et orthographe vérifiés",
  "Couleurs, visuels et mise en page conformes (rendu écran indicatif)",
  "Format, quantités et indications techniques validés",
];

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
  const [deliv, setDeliv] = useState<{ unlocked: boolean; files: any[]; reviews?: any[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState("");
  const [paidNote, setPaidNote] = useState("");
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [obs, setObs] = useState<Record<string, string>>({});
  const [zoom, setZoom] = useState<Record<string, number>>({});
  const [ribOpen, setRibOpen] = useState(false);
  const [signFile, setSignFile] = useState<{ name: string; key: string } | null>(null);
  const [checks, setChecks] = useState([false, false, false]);
  const [signer, setSigner] = useState("");
  const [certView, setCertView] = useState<any>(null);

  const [seenTick, setSeenTick] = useState(0);
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
  const projectTasks: any[] = data.tasks ?? [];
  const projectTasksTotal = Number(data.tasks_total_ht ?? 0);
  
  const linkedPrintOrders: any[] =
    (data.linked_print_orders && data.linked_print_orders.length > 0
      ? data.linked_print_orders
      : data.print_order
        ? [data.print_order]
        : []) ?? [];
  const printOrder = linkedPrintOrders[0] ?? null;
  const invoiceDoc = data.invoice_doc ?? {};
  const reviews: any[] = deliv?.reviews ?? [];
  const pay = data.payment_settings ?? {};
  const methods: string[] = p.payment_methods ?? [];
  const amountDue = p.amount_due_ttc != null ? Number(p.amount_due_ttc) : null;
  const hasAmount = amountDue != null;

  const termsLabel =
    p.payment_terms === "deposit_50"
      ? "Acompte de 50 % à régler"
      : p.payment_terms === "full"
        ? "Totalité à régler"
        : null;
  const declared = !!p.client_declared_paid_at;
  const canPay =
    !p.admin_confirmed_paid_at &&
    ["validated", "payment_pending", "payment_link_requested"].includes(p.status);




  const openInvoice = async () => {
    if (invoiceDoc?.url) { window.open(invoiceDoc.url, "_blank"); return; }
    const { data: res, error } = await supabase.functions.invoke("portal-invoice-url", { body: { token } });
    if (error || (res as any)?.error) return toast.error("Facture indisponible");
    window.open((res as any).url, "_blank");
  };

  const isTask = p.entity_type === "task";
  const title = isTask ? entity.title : entity.name;

  const taskBilling = isTask ? computeTaskBilling(entity) : null;
  const baseAmount = taskBilling?.base ?? 0;
  const extraRevisions = Math.max(
    0,
    Number(entity.client_revisions_count ?? 0) - Number(entity.free_revisions ?? 0)
  );
  const extraRevisionsBilled = extraRevisions * Number(entity.extra_revision_rate ?? 0);
  const totalAmount = taskBilling?.total ?? 0;

  const prestationHT = isTask ? totalAmount : projectTasksTotal;
  // Montant effectif d'une commande : le tarif choisi par le client s'il existe,
  // sinon le montant saisi côté admin.
  const poAmount = (po: any): number => {
    const chosen = (p.print_selections ?? {})[po.id];
    if (chosen && chosen.price != null) return Number(chosen.price);
    return Number(po?.amount ?? 0);
  };
  const poQuantity = (po: any): number | null => {
    const chosen = (p.print_selections ?? {})[po.id];
    if (chosen && chosen.quantity != null) return Number(chosen.quantity);
    return po?.quantity != null ? Number(po.quantity) : null;
  };

  const printHT = linkedPrintOrders.reduce((s: number, o: any) => s + poAmount(o), 0);
  const componentsHT = prestationHT + printHT;
  // Le total HT est la somme des composants (prestation + impressions).
  // On ne retombe sur amount_due_ttc que si aucun composant n'est chiffré.
  const displayTotalHT = componentsHT > 0 ? componentsHT : (amountDue ?? 0);
  const dueAmount =
    displayTotalHT > 0 || hasAmount
      ? (p.payment_terms === "deposit_50" ? displayTotalHT / 2 : displayTotalHT)
      : null;





  const canValidate = p.status === "draft" || p.status === "awaiting_validation";

  const formatTierNumber = (value: number) =>
    value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

  const getPriceTiers = (po: any): PriceTier[] =>
    Array.isArray(po?.price_tiers)
      ? po.price_tiers.filter((tier: PriceTier) => tier.quantity != null && tier.price != null)
      : [];

  // Montant effectif d'une commande : le tarif choisi par le client s'il existe,
  // sinon le montant saisi côté admin.

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
            {isTask && totalAmount > 0 && (
              <Info label="Solde prestation" value={`${totalAmount.toFixed(2)} € HT`} />
            )}
            {isTask && !!entity.estimated_minutes && (
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
          {isTask && extraRevisionsBilled > 0 && (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Forfait</span>
                <span>{baseAmount.toFixed(2)} € HT</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  Retours supplémentaires ({extraRevisions} × {Number(entity.extra_revision_rate).toFixed(2)} €)
                </span>
                <span>{extraRevisionsBilled.toFixed(2)} € HT</span>
              </div>
              <div className="flex items-center justify-between border-t border-border/60 pt-1 font-semibold">
                <span>Total HT</span>
                <span>{totalAmount.toFixed(2)} €</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>TVA 20 %</span>
                <span>{(totalAmount * 0.2).toFixed(2)} €</span>
              </div>
              <div className="flex items-center justify-between font-semibold">
                <span>Total TTC</span>
                <span>{(totalAmount * 1.2).toFixed(2)} €</span>
              </div>
            </div>
          )}
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

        {/* Commande d'impression liée */}
        {!isTask && projectTasks.length > 0 && (
          <section className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Prestations du projet
            </h2>
            <p className="text-xs text-muted-foreground">
              Ce projet regroupe plusieurs prestations, facturées en une seule fois.
            </p>
            <div className="divide-y divide-border/60 rounded-lg border border-border/60">
              {projectTasks.map((t: any) => {
                const extra = Number(t.extra_revisions ?? 0);
                return (
                  <div key={t.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{t.title}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {t.billing_type === "horaire" ? "Au temps" : "Forfait"}
                        {t.deadline ? ` · échéance ${new Date(t.deadline).toLocaleDateString("fr-FR")}` : ""}
                        {extra > 0
                          ? ` · ${extra} retour${extra > 1 ? "s" : ""} supplémentaire${extra > 1 ? "s" : ""}`
                          : ""}
                      </div>
                    </div>
                    <div className="whitespace-nowrap tabular-nums">
                      {Number(t.amount_ht ?? 0).toFixed(2)} € HT
                    </div>
                  </div>
                );
              })}
              <div className="px-3 py-2 text-sm space-y-1">
                <div className="flex items-center justify-between font-semibold">
                  <span>Total du projet HT</span>
                  <span className="tabular-nums">{projectTasksTotal.toFixed(2)} €</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>TVA 20 %</span>
                  <span className="tabular-nums">{(projectTasksTotal * 0.2).toFixed(2)} €</span>
                </div>
                <div className="flex items-center justify-between font-semibold">
                  <span>Total du projet TTC</span>
                  <span className="tabular-nums">{(projectTasksTotal * 1.2).toFixed(2)} €</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {linkedPrintOrders.length > 0 && (
          <section className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Printer className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {linkedPrintOrders.length > 1 ? "Commandes d'impression" : "Commande d'impression"}
              </h2>
              {linkedPrintOrders.length > 1 && (
                <Badge variant="outline" className="text-[10px]">{linkedPrintOrders.length}</Badge>
              )}
            </div>
            <div className="space-y-4">
              {linkedPrintOrders.map((po: any, i: number) => (
                <div key={po.id ?? i} className={i > 0 ? "pt-4 border-t border-border/60 space-y-3" : "space-y-3"}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      {po.reference ? `${po.reference} — ` : ""}{po.description}
                    </span>
                    {po.status && (
                      <Badge variant="outline" className="text-[10px]">{String(po.status).replace(/_/g, " ")}</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                    {poQuantity(po) != null && <Info label="Quantité" value={String(poQuantity(po))} />}
                    {po.format && <Info label="Format" value={po.format} />}
                    {po.support && <Info label="Support" value={po.support} />}
                    {po.grammage && <Info label="Grammage" value={po.grammage} />}
                    {po.colors && <Info label="Couleurs" value={po.colors} />}
                    {po.finitions && <Info label="Finitions" value={po.finitions} />}
                    {poAmount(po) > 0 && <Info label="Montant" value={`${poAmount(po).toFixed(2)} € HT`} />}
                    {po.estimated_delivery_date && (
                      <Info label="Livraison estimée" value={new Date(po.estimated_delivery_date).toLocaleDateString("fr-FR")} />
                    )}
                  </div>
                  {po.observations && (
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{po.observations}</p>
                  )}
                  {getPriceTiers(po).length > 0 && (() => {
                    const chosen = (p.print_selections ?? {})[po.id];
                    return (
                      <div className="rounded-lg border border-border/60 p-3 space-y-2">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Choisissez votre quantité (tarifs HT)
                        </div>
                        <div className="grid gap-1.5 sm:grid-cols-2">
                          {getPriceTiers(po).map((tier, tierIndex) => {
                            const quantity = Number(tier.quantity ?? 0);
                            const price = Number(tier.price ?? 0);
                            const isChosen = chosen && Number(chosen.quantity) === quantity && Number(chosen.price) === price;
                            return (
                              <button
                                type="button"
                                key={`${po.id ?? i}-tier-${tierIndex}`}
                                disabled={busy}
                                onClick={async () => {
                                  setBusy(true);
                                  const { error } = await supabase.rpc("portal_choose_quantity_by_token" as any, {
                                    _token: token, _print_order_id: po.id, _quantity: quantity, _price: price,
                                  });
                                  setBusy(false);
                                  if (error) return toast.error(error.message);
                                  toast.success(`${formatTierNumber(quantity)} ex. sélectionnés`);
                                  // Mise à jour optimiste : le prix change tout de suite à l'écran.
                                  setData((prev: any) => prev ? {
                                    ...prev,
                                    portal: {
                                      ...prev.portal,
                                      print_selections: {
                                        ...(prev.portal.print_selections ?? {}),
                                        [po.id]: { quantity, price },
                                      },
                                    },
                                  } : prev);
                                  load();
                                }}
                                className={`flex items-center justify-between gap-3 text-sm rounded-md border px-3 py-2 text-left transition ${
                                  isChosen ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  <span className={`h-4 w-4 rounded border flex items-center justify-center ${isChosen ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"}`}>
                                    {isChosen && <CheckCircle2 className="h-3 w-3" />}
                                  </span>
                                  {formatTierNumber(quantity)} ex.
                                  {tier.models ? ` · ${formatTierNumber(Number(tier.models))} modèles` : ""}
                                </span>
                                <span className="font-medium tabular-nums">{price.toFixed(2)} € HT</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
            {(() => {
              const printHT = linkedPrintOrders.reduce((s: number, o: any) => s + poAmount(o), 0);
              if (!printHT) return null;
              return (
                <div className="border-t border-border/60 pt-3 space-y-1 text-sm">
                  <div className="flex items-center justify-between font-medium">
                    <span>Total impression HT</span>
                    <span className="tabular-nums">{printHT.toFixed(2)} €</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>TVA 20 %</span>
                    <span className="tabular-nums">{(printHT * 0.2).toFixed(2)} €</span>
                  </div>
                  <div className="flex items-center justify-between font-semibold">
                    <span>Total impression TTC</span>
                    <span className="tabular-nums">{(printHT * 1.2).toFixed(2)} €</span>
                  </div>
                </div>
              );
            })()}
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
          ) : (
            <div className="space-y-2">
              {deliv.files.map((f: any, i: number) => {
                const key = String(f.url ?? i);
                const open = openFile === key;
                return (
                  <div key={i} className="rounded-md border border-border">
                    <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="truncate flex items-center gap-2">
                        {!deliv.unlocked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                        {f.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {(() => {
                          const rv = reviews.find((r: any) => r.file === f.name);
                          if (rv?.status === "approved") {
                            return (
                              <button type="button" onClick={() => setCertView(rv)} title="Voir le certificat">
                                <Badge className="bg-emerald-500 hover:bg-emerald-600 text-[10px] gap-1"><CheckCircle2 className="h-3 w-3" /> BAT signé · certificat</Badge>
                              </button>
                            );
                          }
                          return (
                            <Button
                              size="sm"
                              disabled={busy}
                              onClick={() => { setChecks([false, false, false]); setSignFile({ name: f.name, key }); }}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Valider BAT
                            </Button>
                          );
                        })()}
                        <Button size="sm" variant="outline" onClick={() => setOpenFile(open ? null : key)}>
                          <Eye className="h-3.5 w-3.5 mr-1" /> {open ? "Fermer" : "Visionner"}
                        </Button>
                        {deliv.unlocked && (
                          <Button size="sm" variant="outline" asChild>
                            <a href={f.url} target="_blank" rel="noreferrer"><Download className="h-3.5 w-3.5" /></a>
                          </Button>
                        )}
                      </div>
                    </div>
                    {open && (
                      <div className="border-t border-border p-3 space-y-3">
                        {(() => {
                          const src = f.preview_url ?? f.url;
                          const z = zoom[key] ?? 100;
                          const isImg = /\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i.test(String(f.name ?? src ?? ""));
                          const setZ = (v: number) => setZoom({ ...zoom, [key]: Math.min(400, Math.max(50, v)) });
                          return (
                            <div className="space-y-2">
                              <div className="flex items-center gap-1.5">
                                <Button size="sm" variant="outline" onClick={() => setZ(z - 25)}>
                                  <ZoomOut className="h-3.5 w-3.5" />
                                </Button>
                                <span className="text-[11px] tabular-nums text-muted-foreground w-12 text-center">{z}%</span>
                                <Button size="sm" variant="outline" onClick={() => setZ(z + 25)}>
                                  <ZoomIn className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="sm" variant="ghost" className="text-[11px]" onClick={() => setZ(100)}>
                                  <Maximize2 className="h-3.5 w-3.5 mr-1" /> 100%
                                </Button>
                              </div>
                              <div
                                className="relative w-full h-[75vh] rounded-md overflow-auto bg-muted"
                                onContextMenu={(e) => !deliv.unlocked && e.preventDefault()}
                              >
                                {src ? (
                                  isImg ? (
                                    <img
                                      src={src}
                                      alt={f.name}
                                      draggable={false}
                                      style={{ width: `${z}%`, minWidth: "100%" }}
                                      className="max-w-none block select-none"
                                    />
                                  ) : (
                                    <PdfCanvasViewer src={src} zoom={z} />
                                  )
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                                    Aperçu indisponible pour ce fichier.
                                  </div>
                                )}
                                {!deliv.unlocked && <div className="absolute inset-x-0 top-0 h-10 bg-transparent" />}
                              </div>
                            </div>
                          );
                        })()}
                        <div className="space-y-2">
                          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] leading-relaxed text-muted-foreground space-y-1">
                            <p className="font-semibold text-foreground">Mentions BAT (Bon À Tirer)</p>
                            <p>
                              La validation de ce fichier vaut <strong>Bon À Tirer</strong> : elle autorise la production
                              et/ou la diffusion en l'état.
                            </p>
                            <p>
                              Il vous appartient de vérifier <strong>l'orthographe, la grammaire, les textes, dates,
                              horaires, coordonnées et mentions légales</strong>. Toute erreur non signalée avant
                              validation reste sous votre responsabilité.
                            </p>
                            <p>
                              Les couleurs affichées à l'écran sont indicatives et peuvent différer légèrement du rendu
                              imprimé (profils colorimétriques, papier, finition).
                            </p>
                            <p>
                              Après validation, toute modification pourra faire l'objet d'une facturation
                              complémentaire et d'un nouveau délai.
                            </p>
                          </div>
                          <Textarea
                            rows={2}
                            placeholder="Observation (optionnel)"
                            value={obs[key] ?? ""}
                            onChange={(e) => setObs({ ...obs, [key]: e.target.value })}
                          />
                          <p className="text-[11px] text-muted-foreground">
                            Votre observation sera transmise avec votre validation ou votre demande de modification (boutons en bas de ce bloc).
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {!deliv.unlocked && (
                <p className="text-[11px] text-muted-foreground pt-1">
                  Le téléchargement est désactivé pour le moment — il sera débloqué après paiement du solde dû.
                </p>
              )}
            </div>
          )}

          {canValidate && (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-4 space-y-2">
              <p className="text-sm font-semibold">Validation du livrable (Bon à tirer)</p>
              <p className="text-[11px] text-muted-foreground">
                En validant, vous approuvez le(s) fichier(s) ci-dessus et autorisez la production et/ou la diffusion en l'état.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button
                  onClick={async () => {
                    const note = Object.values(obs).filter((v) => v?.trim()).join("\n");
                    if (note) await act("add_message", { body: `Observation du client :\n${note}` });
                    await act("validate");
                    setObs({});
                  }}
                  disabled={busy}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Valider (Bon à tirer)
                </Button>
              </div>
            </div>
          )}
        </section>

        {(() => {
          const lastAdmin = [...messages].reverse().find((m: any) => m.author === "admin");
          if (!lastAdmin) return null;
          const key = `portal-seen-${p.id}`;
          void seenTick;
          const seen = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
          if (seen && seen >= lastAdmin.created_at) return null;
          const markSeen = () => { window.localStorage.setItem(key, lastAdmin.created_at); setSeenTick((n) => n + 1); };
          const isCorrection = lastAdmin.kind === "correction";
          return (
            <section className={`rounded-xl border p-5 space-y-2 ${isCorrection ? "border-emerald-500/40 bg-emerald-500/5" : "border-primary/40 bg-primary/5"}`}>
              <div className="flex items-center gap-2 text-sm font-semibold">
                {isCorrection && <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                {isCorrection ? "Votre correction est prête" : "Nouveau message de l'atelier"}
              </div>
              <div className="text-sm whitespace-pre-wrap">{lastAdmin.body}</div>
              <div className="flex gap-3 text-xs">
                <a href="#echanges" onClick={markSeen} className="underline">Voir les échanges</a>
                <button onClick={markSeen} className="text-muted-foreground underline">J'ai lu</button>
              </div>
            </section>
          );
        })()}

        {/* Refus affiché */}
        {p.status === "refused" && (
          <section className="rounded-xl border border-rose-500/40 bg-rose-500/5 p-5">
            <div className="text-sm font-medium">Demande refusée</div>
            {p.refusal_reason && <div className="text-sm text-muted-foreground mt-1">Motif : {p.refusal_reason}</div>}
          </section>
        )}

        {/* Règlement */}
        {(termsLabel || dueAmount != null || printOrder || methods.length > 0 || invoiceDoc?.url || invoiceDoc?.has_file) && (
          <section className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-5 space-y-3">
            <h2 className="text-sm font-semibold">Règlement</h2>
            {(termsLabel || dueAmount != null) && (
              <div className="space-y-2">
                <p className="text-sm">
                  {termsLabel ?? "Montant à régler"}
                  {dueAmount != null && (
                    <>
                      {" — "}
                      <strong className="text-base text-foreground">{(dueAmount * 1.2).toFixed(2)} € TTC</strong>
                    </>
                  )}
                </p>
                <div className="rounded-lg border border-border/60 bg-background p-3 space-y-1.5 text-sm">
                  {prestationHT > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Prestation</span>
                      <span className="tabular-nums">{prestationHT.toFixed(2)} € HT</span>
                    </div>
                  )}
                  {printHT > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Impression</span>
                      <span className="tabular-nums">{printHT.toFixed(2)} € HT</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total HT</span>
                    <span className="tabular-nums font-medium">{displayTotalHT.toFixed(2)} €</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>TVA 20 %</span>
                    <span className="tabular-nums">{(displayTotalHT * 0.2).toFixed(2)} €</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-border/60 pt-1.5">
                    <span className="font-semibold">Total TTC</span>
                    <span className="font-semibold tabular-nums">{(displayTotalHT * 1.2).toFixed(2)} €</span>
                  </div>
                </div>
                {p.payment_terms === "deposit_50" && amountDue != null && (
                  <p className="text-xs text-muted-foreground">
                    Acompte de 50 % demandé ({(dueAmount * 1.2).toFixed(2)} € TTC) sur un total de {(displayTotalHT * 1.2).toFixed(2)} € TTC.
                  </p>
                )}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {p.payment_terms === "deposit_50"
                ? "Pour télécharger votre fichier, veuillez régler l'acompte de 50 % de la prestation en cours."
                : p.payment_terms === "full"
                  ? "Pour télécharger votre fichier, veuillez régler la totalité de la prestation en cours."
                  : "Le téléchargement des livrables est débloqué après confirmation du paiement."}
            </p>
            {printOrder && (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Pour toute commande d’impression, merci de régler la facture afin de lancer la production.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {(invoiceDoc?.url || invoiceDoc?.has_file) && (
                <Button size="sm" variant="outline" onClick={openInvoice}>
                  <FileText className="h-3.5 w-3.5 mr-1" /> Télécharger la facture
                </Button>
              )}
              {methods.includes("link") &&
                (p.payment_link_url ? (
                  <Button size="sm" asChild>
                    <a href={p.payment_link_url} target="_blank" rel="noreferrer">
                      <CreditCard className="h-3.5 w-3.5 mr-1" /> Payer par carte
                    </a>
                  </Button>
                ) : canPay && p.status !== "payment_link_requested" ? (
                  <Button size="sm" variant="outline" onClick={() => act("request_payment_link")} disabled={busy}>
                    <CreditCard className="h-3.5 w-3.5 mr-1" /> Demander un lien de paiement
                  </Button>
                ) : null)}
              {methods.includes("transfer") && (
                <Button size="sm" variant="outline" onClick={() => setRibOpen(true)}>
                  <Landmark className="h-3.5 w-3.5 mr-1" /> Payer par virement (RIB)
                </Button>
              )}
            </div>
            {canPay && !declared && methods.length > 0 && (
              <div className="rounded-lg border border-border bg-background p-3 space-y-2">
                <div className="text-sm font-medium">Vous avez payé ?</div>
                <Input placeholder="Référence / date du paiement (optionnel)" value={paidNote} onChange={(e) => setPaidNote(e.target.value)} />
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

        {/* Messages */}
        <section id="echanges" className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Échanges</h2>
          {messages.length === 0 ? (
            <div className="text-xs text-muted-foreground">Aucun message pour le moment.</div>
          ) : (
            <div className="space-y-2">
              {messages.map((m: any) => (
                <div key={m.id} className={`text-sm p-3 rounded-md ${m.author === "client" ? "bg-primary/10" : m.kind === "correction" ? "bg-emerald-500/10" : "bg-muted/40"}`}>
                  <div className="mb-0.5 flex items-center gap-2 text-[10px] uppercase text-muted-foreground">
                    <span>{m.author === "client" ? "Vous" : "Studio"} · {new Date(m.created_at).toLocaleString("fr-FR")}</span>
                    {m.kind === "correction" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-2.5 w-2.5" /> Corrigé
                      </span>
                    )}
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

      <Dialog open={!!signFile} onOpenChange={(o) => !o && setSignFile(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Signer le Bon à Tirer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="text-xs text-muted-foreground truncate">Fichier : <span className="font-medium text-foreground">{signFile?.name}</span></div>
            <div className="space-y-2.5">
              {BAT_CHECKS.map((c, i) => (
                <label key={i} className="flex items-start gap-2.5 cursor-pointer">
                  <Checkbox checked={checks[i]} onCheckedChange={(v) => setChecks(checks.map((x, j) => (j === i ? !!v : x)))} className="mt-0.5" />
                  <span>{c}</span>
                </label>
              ))}
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-medium">Nom et prénom (signature) *</div>
              <Input value={signer} onChange={(e) => setSigner(e.target.value)} maxLength={100} placeholder="Jean Dupont" />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Votre signature vaut « Bon pour impression ». La date, l'heure et le fichier validé sont enregistrés dans un certificat.
              Toute erreur non signalée avant validation ne pourra engager la responsabilité du studio.
            </p>
            <Button
              className="w-full"
              disabled={busy || !checks.every(Boolean) || !signer.trim()}
              onClick={async () => {
                if (!signFile) return;
                await act("approve_file", {
                  file: signFile.name, note: obs[signFile.key]?.trim() || null,
                  signed_by: signer.trim(), checks: checks.filter(Boolean).length, user_agent: navigator.userAgent,
                });
                setSignFile(null);
                toast.success("BAT signé — certificat généré");
              }}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" /> Bon pour impression — Signer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!certView} onOpenChange={(o) => !o && setCertView(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Certificat de validation BAT</DialogTitle>
          </DialogHeader>
          {certView && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border border-border p-4 space-y-2">
                <Info label="N° de certificat" value={certView.certificate_id ?? "—"} />
                <Info label="Fichier validé" value={certView.file} />
                <Info label="Signé par" value={certView.signed_by ?? "—"} />
                <Info label="Date et heure" value={new Date(certView.at).toLocaleString("fr-FR")} />
                {client?.name && <Info label="Client" value={client.name} />}
                {certView.note && <Info label="Observation" value={certView.note} />}
              </div>
              <ul className="text-xs text-muted-foreground space-y-1">
                {BAT_CHECKS.map((c, i) => <li key={i}>✓ {c}</li>)}
              </ul>
              <Button variant="outline" className="w-full" onClick={() => window.print()}>Imprimer / PDF</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={ribOpen} onOpenChange={setRibOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Coordonnées bancaires</DialogTitle>
          </DialogHeader>
          {pay?.iban ? (
            <div className="space-y-1">
              <RibRow label="Titulaire" value={pay.account_holder} />
              <RibRow label="IBAN" value={pay.iban} copy />
              <RibRow label="BIC" value={pay.bic} copy />
              {pay.bank_name && <RibRow label="Banque" value={pay.bank_name} />}
              {dueAmount != null && (
                <div className="text-sm pt-2">Montant à régler : <strong>{(dueAmount * 1.2).toFixed(2)} € TTC</strong></div>
              )}
              {pay.transfer_note && (
                <div className="text-xs text-muted-foreground pt-1">{pay.transfer_note}</div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Les coordonnées bancaires vont vous être communiquées.</div>
          )}
        </DialogContent>
      </Dialog>
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
