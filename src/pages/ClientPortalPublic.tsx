import ClientBatApproval, { CLIENT_BAT_CHECKS } from "@/components/ClientBatApproval";
import { isFileApproved, reviewForFile } from "@/lib/deliverableReview";
import ClientOrderProgress, { ClientOrderHistory } from "@/components/ClientOrderProgress";
import DocumentViewer from "@/components/DocumentViewer";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, Copy, Send, Download, FileText, Printer, CreditCard, Landmark } from "lucide-react";
import { toast } from "sonner";
import { computeTaskBilling } from "@/lib/billing";



type PriceTier = { quantity?: number | null; models?: number | null; price?: number | null };

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
  const [ribOpen, setRibOpen] = useState(false);
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
  const [annots, setAnnots] = useState<any[]>([]);
  const loadAnnots = async () => {
    if (!token) return;
    const { data: a } = await supabase.rpc("portal_annotations_by_token" as any, { _token: token });
    setAnnots((a as any[]) ?? []);
  };
  useEffect(() => { load(); loadAnnots(); }, [token]);

  const act = async (action: string, payload: any = {}) => {
    setBusy(true);
    const { error } = await supabase.rpc("portal_action_by_token" as any, { _token: token, _action: action, _payload: payload });
    setBusy(false);
    if (error) { toast.error(error.message); return false; }
    await load();
    return true;
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

  const files = deliv?.files ?? [];
  const selectedFile = files.find((f: any) => String(f.url ?? f.name) === openFile) ?? files[0];
  const selectedKey = selectedFile ? String(selectedFile.url ?? selectedFile.name) : "";
  const selectedReview = selectedFile && isFileApproved(reviews, selectedFile) ? reviewForFile(reviews, selectedFile) : undefined;
  const allApproved = files.length > 0 && files.every((f: any) => isFileApproved(reviews, f));
  const delivered = p.status === "delivered" || (linkedPrintOrders.length > 0 && linkedPrintOrders.every((o: any) => ["livre", "livre_paye"].includes(o.status)));
  const printing = linkedPrintOrders.some((o: any) => ["en_impression", "livre", "livre_paye"].includes(o.status)) || (linkedPrintOrders.length === 0 && entity.status === "impression");
  const impression = linkedPrintOrders.length > 0 || entity.status === "impression";
  const downloadReady = !impression && allApproved && !!deliv?.unlocked;
  const progressCompleted = impression ? delivered : downloadReady;
  // Un nouveau fichier non validé ramène toujours le suivi à la première étape (Maquette), quel que soit l'état précédent
  const pendingFile = files.length > 0 && !allApproved;
  const progressStep = pendingFile ? 0 : delivered || printing || downloadReady ? 3 : allApproved || p.client_validated_at ? 2 : 0;
  const progressDetail = downloadReady
    ? "Vos fichiers sont disponibles au téléchargement."
    : delivered
    ? "La livraison de votre commande est confirmée."
    : printing
      ? "Votre commande est en production à l’atelier."
      : allApproved
        ? impression ? "BAT validé — récapitulatif et règlement de la prestation et/ou de l’impression." : "BAT validé — récapitulatif et règlement de la prestation avant mise à disposition des fichiers."
        : files.length > 0
          ? "Votre accord est attendu avant de poursuivre."
          : "L’atelier prépare votre maquette.";
  const deliveryDates = linkedPrintOrders.map((order: any) => order.estimated_delivery_date).filter((date: unknown): date is string => typeof date === "string" && !Number.isNaN(new Date(date).getTime()));
  const deliveryDeadline = deliveryDates.sort().slice(-1)[0];
  const history = [
    ...(p.delivered_at ? [{ label: "Commande livrée", at: p.delivered_at }] : []),
    ...reviews.filter((r: any) => r.status === "approved").map((r: any) => ({ label: `BAT validé : ${r.file}`, at: r.at, detail: r.signed_by ? `Signé par ${r.signed_by}` : undefined })),
    ...linkedPrintOrders.filter((o: any) => o.bat_validated_at).map((o: any) => ({ label: `BAT de la commande ${o.reference ?? o.description ?? "d’impression"} validé`, at: o.bat_validated_at })),
    ...(p.client_validated_at ? [{ label: "Validation de la commande", at: p.client_validated_at }] : []),
    ...(p.created_at ? [{ label: "Commande reçue", at: p.created_at }] : []),
  ].sort((a, b) => String(b.at ?? "").localeCompare(String(a.at ?? "")));

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <span className="font-semibold">Suivi de votre commande</span>
          <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="max-w-64 truncate">{title}</span><Badge variant="outline">{STATUS_LABEL[p.status] ?? p.status}</Badge></div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        <ClientOrderProgress step={progressStep} events={[]} deadline={deliveryDeadline} completed={progressCompleted} detail={progressDetail} impression={impression} />
        {allApproved && !progressCompleted && !printing && <div className="pt-4"><Button variant="outline" asChild><a href="#reglement"><CreditCard className="mr-2 h-4 w-4" />Récapitulatif & règlement</a></Button></div>}
      </div>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {files.length > 0 && selectedFile ? (
          <section aria-label="Votre BAT" className="grid min-w-0 gap-7 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:gap-10">
            <div className="min-w-0 space-y-4">
              {files.length > 1 && <div className="flex flex-wrap gap-2">{files.map((f: any, i: number) => <Button key={f.name ?? i} size="sm" variant={selectedFile === f ? "default" : "outline"} onClick={() => setOpenFile(String(f.url ?? f.name))}>BAT {i + 1}{isFileApproved(reviews, f) && <CheckCircle2 className="ml-2 h-3 w-3" />}</Button>)}</div>}
              {(selectedFile.preview_url ?? selectedFile.url) ? <DocumentViewer
                key={selectedKey}
                viewportClassName={allApproved ? "h-[min(38vh,420px)]" : "h-[min(65vh,760px)]"}
                src={selectedFile.preview_url ?? selectedFile.url}
                isImage={/\.(png|jpe?g|webp|gif|avif|svg)(\?|#|$)/i.test(String(selectedFile.name ?? selectedFile.url))}
                alt={selectedFile.name}
                protect={!deliv?.unlocked}
                canAnnotate={!selectedReview}
                annotations={annots.filter(a => a.file_name === selectedFile.name)}
                onAdd={async a => {
                  const { error } = await supabase.rpc("portal_add_annotation_by_token" as any, { _token: token, _file: selectedFile.name, _page: a.page, _x: a.x, _y: a.y, _comment: a.comment });
                  if (error) return void toast.error(error.message);
                  toast.success("Annotation envoyée à l’atelier"); loadAnnots();
                }}
                onDelete={async id => { await supabase.rpc("portal_delete_annotation_by_token" as any, { _token: token, _id: id }); loadAnnots(); }}
              /> : <div className="flex h-96 items-center justify-center bg-muted text-sm text-muted-foreground">Aperçu indisponible pour ce fichier.</div>}
              <div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><p className="break-all text-sm font-semibold">{selectedFile.name}</p><p className="mt-1 text-xs text-muted-foreground">{deliv?.unlocked ? "Téléchargement disponible" : "Téléchargement débloqué après règlement"}</p></div>{deliv?.unlocked && <Button variant="outline" size="sm" asChild><a href={selectedFile.url} target="_blank" rel="noreferrer"><Download className="mr-2 h-4 w-4" />Télécharger</a></Button>}</div>
            </div>
            <div className="min-w-0 space-y-6">
              <header className="space-y-2">{client?.name && <p className="text-sm text-muted-foreground">Bonjour <strong className="text-foreground">{client.name}</strong>,</p>}<h1 className="text-3xl font-semibold leading-tight tracking-normal">{selectedReview ? "Merci, c’est validé" : "Votre BAT est prêt à être validé"}</h1><p className="text-sm text-muted-foreground break-words">{title}</p></header>
              <ClientBatApproval key={selectedKey} busy={busy} approved={!!selectedReview} signedBy={selectedReview?.signed_by} signedAt={selectedReview?.at}
                onApprove={async name => { const ok = await act("approve_file", { file: selectedFile.name, signed_by: name, checks: 3, user_agent: navigator.userAgent }); if (ok) toast.success("BAT signé — certificat généré"); return ok; }}
                onCorrection={async note => { const ok = await act("request_changes", { file: selectedFile.name, note }); if (ok) toast.success("Demande de correction envoyée à l’atelier"); return ok; }}
                onCertificate={selectedReview ? () => setCertView(selectedReview) : undefined}
                downloadUrl={deliv?.unlocked && selectedReview ? selectedFile.url : undefined}
              />
              {allApproved && canValidate && <Button variant="outline" className="w-full" disabled={busy} onClick={() => act("validate")}><CheckCircle2 className="mr-2 h-4 w-4" />Confirmer l’ensemble de la commande</Button>}
            </div>
          </section>
        ) : <header className="space-y-2"><h1 className="text-3xl font-semibold tracking-normal">{title}</h1>{client?.name && <p className="text-sm text-muted-foreground">Pour {client.name}</p>}<p className="text-sm text-muted-foreground">Votre BAT est en cours de préparation.</p></header>}
        {canValidate && files.length === 0 && <Button disabled={busy} onClick={() => act("validate")}><CheckCircle2 className="mr-2 h-4 w-4" />Valider la commande</Button>}
        {/* Brief */}
        {(entity.notes || entity.description) && (
          <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm sm:p-8 space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Brief</h2>
            <p className="text-sm whitespace-pre-wrap">{entity.notes || entity.description}</p>
          </section>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="min-w-0 space-y-6">
        {/* Récap */}
        <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm sm:p-8 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Récapitulatif de la commande</h2>
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
                  <span className={`h-2 w-2 rounded-full ${s.done ? "bg-success" : "bg-muted-foreground/40"}`} />
                  <span className={s.done ? "line-through text-muted-foreground" : ""}>{s.title}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {linkedPrintOrders.length > 0 && (
          <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm sm:p-8 space-y-4">
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
                              <Button
                                variant="outline"
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
                                className={`flex items-center justify-between gap-3 h-auto whitespace-normal text-sm rounded-md border px-3 py-2 text-left transition ${
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
                              </Button>
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
        </div>

        <ClientOrderHistory step={progressStep} events={history} deadline={deliveryDeadline} completed={progressCompleted} detail={progressDetail} impression={impression} />
        </div>

        {/* Commande d'impression liée */}
        {!isTask && projectTasks.length > 0 && (
          <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm sm:p-8 space-y-3">
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
            <section className={`rounded-md border p-5 space-y-2 ${isCorrection ? "border-success/40 bg-success/5" : "border-primary/40 bg-primary/5"}`}>
              <div className="flex items-center gap-2 text-sm font-semibold">
                {isCorrection && <CheckCircle2 className="h-4 w-4 text-success" />}
                {isCorrection ? "Votre correction est prête" : "Nouveau message de l'atelier"}
              </div>
              <div className="text-sm whitespace-pre-wrap">{lastAdmin.body}</div>
              <div className="flex gap-3 text-xs">
                <a href="#echanges" onClick={markSeen} className="underline">Voir les échanges</a>
                <Button variant="ghost" size="sm" onClick={markSeen}>J’ai lu</Button>
              </div>
            </section>
          );
        })()}

        {/* Refus affiché */}
        {p.status === "refused" && (
          <section className="rounded-md border border-destructive/40 bg-destructive/5 p-5">
            <div className="text-sm font-medium">Demande refusée</div>
            {p.refusal_reason && <div className="text-sm text-muted-foreground mt-1">Motif : {p.refusal_reason}</div>}
          </section>
        )}

        {/* Règlement */}
        {(termsLabel || dueAmount != null || printOrder || methods.length > 0 || invoiceDoc?.url || invoiceDoc?.has_file) && (
          <section id="reglement" className="scroll-mt-6 rounded-2xl border border-border/60 bg-card p-5 shadow-sm sm:p-8 space-y-3">
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
              <p className="text-sm text-warning">
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
              <div className="text-xs bg-warning/10 text-warning rounded p-2">
                Merci ! Nous vérifions la réception du paiement.
              </div>
            )}
          </section>
        )}

        {/* Messages */}
        <section id="echanges" className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm sm:p-8 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Échanges</h2>
          {messages.length === 0 ? (
            <div className="text-xs text-muted-foreground">Aucun message pour le moment.</div>
          ) : (
            <div className="space-y-2">
              {messages.map((m: any) => (
                <div key={m.id} className={`text-sm p-3 rounded-md ${m.author === "client" ? "bg-primary/10" : m.kind === "correction" ? "bg-success/10" : "bg-muted/40"}`}>
                  <div className="mb-0.5 flex items-center gap-2 text-[10px] uppercase text-muted-foreground">
                    <span>{m.author === "client" ? "Vous" : "Studio"} · {new Date(m.created_at).toLocaleString("fr-FR")}</span>
                    {m.kind === "correction" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[9px] font-semibold uppercase text-success">
                        <CheckCircle2 className="h-2.5 w-2.5" /> Corrigé
                      </span>
                    )}
                    {m.author === "client" && m.resolved && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[9px] font-semibold uppercase text-success">
                        <CheckCircle2 className="h-2.5 w-2.5" /> Prise en compte
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
                {CLIENT_BAT_CHECKS.map((c, i) => <li key={i}>✓ {c}</li>)}
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
      <div className="break-words text-sm font-medium">{value}</div>
    </div>
  );
}
