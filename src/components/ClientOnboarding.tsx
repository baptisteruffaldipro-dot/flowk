import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FolderOpen, ListChecks, Printer, ClipboardList, FileCheck2, Receipt, CalendarClock, ChevronRight, AlertCircle, ExternalLink, Mail, Palette, Copy, Check, HelpCircle, Sparkles, CreditCard, Download, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fmtMoney,
  fmtDate,
  fmtDateTime,
  STATUS_LABEL,
  PRINT_STATUS_LABEL,
  BAT_STATUS_LABEL,
  INVOICE_STATUS_LABEL,
  PROJECT_TYPE_LABEL,
} from "@/lib/format";

type Mode = "admin" | "client";

export default function ClientOnboarding({ clientId, mode }: { clientId: string; mode: Mode }) {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [bats, setBats] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [logoPresentations, setLogoPresentations] = useState<any[]>([]);
  const [questionnaires, setQuestionnaires] = useState<any[]>([]);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [portals, setPortals] = useState<any[]>([]);
  const [sendingOnboarding, setSendingOnboarding] = useState(false);
  const [clientInfo, setClientInfo] = useState<{ name: string | null; email: string | null } | null>(null);
  const [copiedPortal, setCopiedPortal] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    (async () => {
      setLoading(true);
      const nowIso = new Date().toISOString();
      const [p, t, o, b, i, a, lp, q, bs] = await Promise.all([
        supabase.from("projects").select("*").eq("client_id", clientId).eq("archived", false).order("created_at", { ascending: false }),
        supabase.from("tasks").select("id,title,status,deadline,project_id,delivered_at,priority").eq("client_id", clientId).order("deadline", { ascending: true, nullsFirst: false }),
        supabase.from("print_orders").select("id,description,status,amount,estimated_delivery_date,bat_file_path,bat_validated_at,bat_rejected_at").eq("client_id", clientId).order("created_at", { ascending: false }),
        supabase.from("bats").select("id,title,status,validated_at,project_id").eq("client_id", clientId).order("created_at", { ascending: false }),
        supabase.from("invoices").select("*, tasks(id, project_id)").eq("client_id", clientId).order("created_at", { ascending: false }),
        supabase.from("appointments").select("id,title,start_at,duration_minutes,location,type,status").eq("client_id", clientId).gte("start_at", nowIso).order("start_at", { ascending: true }),
        supabase.from("logo_presentations" as any).select("id,project_name,version,is_published,share_token,updated_at").eq("client_id", clientId).order("updated_at", { ascending: false }),
        supabase.from("questionnaires").select("id,title,template,status,share_token,submitted_at,updated_at").eq("client_id", clientId).order("updated_at", { ascending: false }),
        supabase.from("brand_strategies").select("id,project_name,version,is_published,share_token,updated_at").eq("client_id", clientId).order("updated_at", { ascending: false }),
      ]);
      setProjects(p.data ?? []);
      setTasks(t.data ?? []);
      setOrders(o.data ?? []);
      setBats(b.data ?? []);
      setInvoices(i.data ?? []);
      setAppointments(a.data ?? []);
      setLogoPresentations((lp as any).data ?? []);
      setQuestionnaires(q.data ?? []);
      setStrategies(bs.data ?? []);
      const { data: cp } = await supabase
        .from("client_portals" as any)
        .select("id,entity_type,entity_id,share_token,is_published,status,delivery_unlock_rule,delivery_override,admin_confirmed_paid_at")
        .eq("client_id", clientId);
      setPortals((cp as any) ?? []);
      setLoading(false);
    })();
  }, [clientId]);

  useEffect(() => {
    if (!clientId || mode !== "admin") return;
    (async () => {
      const { data } = await supabase.from("clients").select("name,email").eq("id", clientId).maybeSingle();
      if (data) setClientInfo({ name: data.name, email: data.email });
    })();
  }, [clientId, mode]);

  const sendOnboardingEmail = async () => {
    if (!clientInfo?.email) return toast.error("Le client n'a pas d'email enregistré");
    setSendingOnboarding(true);
    const portalUrl = `${window.location.origin}/portail`;
    const { data, error } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "onboarding-ready",
        recipientEmail: clientInfo.email,
        idempotencyKey: `onboarding-ready-${clientId}-${Date.now()}`,
        templateData: { name: clientInfo.name ?? undefined, portalUrl },
      },
    });
    setSendingOnboarding(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Échec de l'envoi");
      return;
    }
    toast.success(`Email envoyé à ${clientInfo.email}`, {
      description: "Une copie a été transmise à bonjour@atelier-rufo.fr",
    });
  };

  const copyPortalLink = async () => {
    const url = `${window.location.origin}/portail`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedPortal(true);
      toast.success("Lien copié");
      setTimeout(() => setCopiedPortal(false), 2000);
    } catch {
      toast.error("Impossible de copier");
    }
  };

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tasksInProgress = tasks.filter((t) => !t.delivered_at && !["payee", "facturee", "facture_envoyee", "archive"].includes(t.status));
  const hasBriefContent = (p: any) => {
    if (p.description && String(p.description).trim()) return true;
    if (p.notes && String(p.notes).trim()) return true;
    const b = p.brief;
    if (b && typeof b === "object") {
      return Object.values(b).some((v) => typeof v === "string" ? v.trim().length > 0 : v != null && v !== "");
    }
    return false;
  };
  const isBriefDone = (p: any) => !!p.brief_submitted_at || hasBriefContent(p);
  const batsToValidate = [
    ...orders.filter((o) => o.bat_file_path && !o.bat_validated_at && !o.bat_rejected_at).map((o) => ({ id: o.id, title: o.description, kind: "order" as const, status: "À valider" })),
    ...bats.filter((b) => b.status === "en_relecture").map((b) => ({ id: b.id, title: b.title, kind: "bat" as const, status: BAT_STATUS_LABEL[b.status] })),
  ];

  const totalInv = invoices.reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const paidInv = invoices.filter((i) => i.status === "payee").reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const pendingInv = totalInv - paidInv;

  const invoiceHref = (i: any): string | null => {
    if (i.task_id) {
      if (mode === "admin") return `/taches/${i.task_id}`;
      const pid = i.tasks?.project_id;
      return pid ? `/portail/projet/${pid}` : null;
    }
    if (i.print_order_id) {
      return mode === "admin" ? `/impressions/${i.print_order_id}` : `/portail/impression/${i.print_order_id}`;
    }
    return null;
  };

  const updateInvoiceStatus = async (id: string, status: string) => {
    const patch: any = { status };
    if (status === "facturee") patch.invoiced_at = new Date().toISOString().slice(0, 10);
    if (status === "payee") patch.paid_at = new Date().toISOString().slice(0, 10);
    const prev = invoices;
    setInvoices((arr) => arr.map((x) => x.id === id ? { ...x, ...patch } : x));
    const { error } = await supabase.from("invoices").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      setInvoices(prev);
    }
  };

  const taskHref = (t: any) => mode === "admin" ? `/taches/${t.id}` : (t.project_id ? `/portail/projet/${t.project_id}` : "#");
  const projHref = (p: any) => mode === "admin" ? `/projets/${p.id}` : `/portail/projet/${p.id}`;
  const orderHref = (o: any) => mode === "admin" ? `/impressions/${o.id}` : `/portail/impression/${o.id}`;
  const batHref = (b: any) => mode === "admin" ? `/bats/${b.id}` : `/portail/bat/${b.id}`;

  const portalFor = (kind: "task" | "project", id: string) =>
    portals.find((p) => p.entity_type === kind && p.entity_id === id && p.is_published);

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Chargement…</div>;

  return (
    <div className="space-y-6">
      {/* Bandeaux d'alerte */}
      {batsToValidate.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
            <Card className="p-4 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-amber-900 dark:text-amber-200">{batsToValidate.length} BAT en attente de validation</div>
                <div className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">À visualiser et signer.</div>
              </div>
            </Card>
        </div>
      )}

      <Section icon={<FolderOpen className="h-4 w-4" />} title="Projets" count={projects.length}>
        {projects.length === 0 ? <Empty text="Aucun projet" /> : projects.map((p) => {
          const pTasks = tasks.filter((t) => t.project_id === p.id);
          const done = pTasks.filter((t) => t.delivered_at || ["payee", "facturee", "facture_envoyee"].includes(t.status)).length;
          const pct = pTasks.length ? Math.round((done / pTasks.length) * 100) : (isBriefDone(p) ? 10 : 0);
          const late = pTasks.some((t) => t.deadline && !t.delivered_at && new Date(t.deadline) < today);
          return (
            <Link key={p.id} to={projHref(p)} className="block p-3 hover:bg-secondary/60 transition">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {PROJECT_TYPE_LABEL[p.type] ?? p.type}
                    {p.deadline && <span> · échéance {fmtDate(p.deadline)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {late && <Badge className="bg-rose-500 hover:bg-rose-500 text-[10px]">En retard</Badge>}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="text-[10px] text-muted-foreground tabular-nums w-16 text-right">{done}/{pTasks.length} · {pct}%</div>
              </div>
            </Link>
          );
        })}
      </Section>

      <Section icon={<ListChecks className="h-4 w-4" />} title="Tâches en cours" count={tasksInProgress.length}>
        {tasksInProgress.length === 0 ? <Empty text="Aucune tâche en cours" /> : tasksInProgress.map((t) => {
          const late = t.deadline && new Date(t.deadline) < today;
          return (
            <Link key={t.id} to={taskHref(t)} className="flex items-center justify-between p-3 hover:bg-secondary/60 transition">
              <div className="min-w-0">
                <div className="text-sm truncate">{t.title}</div>
                {t.deadline && <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" /> {fmtDate(t.deadline)}</div>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {late && <Badge className="bg-rose-500 hover:bg-rose-500 text-[10px]">En retard</Badge>}
                <Badge variant="outline" className="text-[10px]">{STATUS_LABEL[t.status] ?? t.status}</Badge>
              </div>
            </Link>
          );
        })}
      </Section>

      <Section icon={<Printer className="h-4 w-4" />} title="Impression" count={orders.length}>
        {orders.length === 0 ? <Empty text="Aucune commande" /> : orders.map((o) => (
          <Link key={o.id} to={orderHref(o)} className="flex items-center justify-between p-3 hover:bg-secondary/60 transition">
            <div className="min-w-0">
              <div className="text-sm truncate">{o.description}</div>
              <div className="text-[11px] text-muted-foreground">
                {PRINT_STATUS_LABEL[o.status] ?? o.status}
                {o.estimated_delivery_date && <span> · livraison {fmtDate(o.estimated_delivery_date)}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {o.bat_file_path && !o.bat_validated_at && !o.bat_rejected_at && <Badge className="bg-amber-500 hover:bg-amber-500 text-[10px]">BAT à valider</Badge>}
              {o.bat_validated_at && <Badge className="bg-emerald-500 hover:bg-emerald-500 text-[10px]">BAT validé</Badge>}
              {o.amount != null && <span className="text-xs text-muted-foreground">{fmtMoney(Number(o.amount))}</span>}
            </div>
          </Link>
        ))}
      </Section>

      {(() => {
        const briefs = projects.filter((p) => isBriefDone(p));
        return (
          <Section icon={<ClipboardList className="h-4 w-4" />} title="Briefs" count={briefs.length}>
            {briefs.length === 0 ? <Empty text="Aucun brief" /> : briefs.map((p) => (
              <Link key={p.id} to={projHref(p)} className="flex items-center justify-between p-3 hover:bg-secondary/60 transition">
                <div className="min-w-0">
                  <div className="text-sm truncate">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {p.brief_submitted_at
                      ? `Soumis le ${fmtDateTime(p.brief_submitted_at)}`
                      : "Rempli (non soumis)"}
                  </div>
                </div>
                {p.brief_submitted_at
                  ? <Badge className="bg-emerald-500 hover:bg-emerald-500 text-[10px]">Reçu</Badge>
                  : <Badge className="bg-emerald-500/80 hover:bg-emerald-500/80 text-[10px]">Rempli</Badge>}
              </Link>
            ))}
          </Section>
        );
      })()}

      <Section icon={<FileCheck2 className="h-4 w-4" />} title="Bons à tirer" count={bats.length}>
        {bats.length === 0 ? <Empty text="Aucun BAT" /> : bats.map((b) => (
          <Link key={b.id} to={batHref(b)} className="flex items-center justify-between p-3 hover:bg-secondary/60 transition">
            <div className="min-w-0">
              <div className="text-sm truncate">{b.title}</div>
              <div className="text-[11px] text-muted-foreground">{BAT_STATUS_LABEL[b.status]}</div>
            </div>
            {b.status === "en_relecture" && <Badge className="bg-amber-500 hover:bg-amber-500 text-[10px]">À valider</Badge>}
            {b.status === "valide" && <Badge className="bg-emerald-500 hover:bg-emerald-500 text-[10px]">Validé</Badge>}
          </Link>
        ))}
      </Section>

      <Section icon={<Receipt className="h-4 w-4" />} title="Facturation" count={invoices.length}
        right={
          invoices.length > 0 && (
            <div className="text-[11px] text-muted-foreground">
              Total {fmtMoney(totalInv)} · Payé {fmtMoney(paidInv)} · Restant <span className="text-foreground font-medium">{fmtMoney(pendingInv)}</span>
            </div>
          )
        }
      >
        {invoices.length === 0 ? <Empty text="Aucune facture" /> : invoices.map((i) => {
          const href = invoiceHref(i);
          return (
          <div key={i.id} className="flex items-center justify-between gap-3 p-3">
            {href ? (
              <Link to={href} className="min-w-0 flex-1 group">
                <div className="text-sm truncate group-hover:underline inline-flex items-center gap-1.5">
                  {i.label}
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {i.billing_type === "horaire" && i.hours
                    ? `${i.hours}h × ${fmtMoney(Number(i.hourly_rate ?? 0))}`
                    : "Forfait"}
                  {i.invoiced_at && ` · ${fmtDate(i.invoiced_at)}`}
                </div>
              </Link>
            ) : (
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate">{i.label}</div>
                <div className="text-[11px] text-muted-foreground">
                  {i.billing_type === "horaire" && i.hours
                    ? `${i.hours}h × ${fmtMoney(Number(i.hourly_rate ?? 0))}`
                    : "Forfait"}
                  {i.invoiced_at && ` · ${fmtDate(i.invoiced_at)}`}
                </div>
              </div>
            )}
            <span className="text-sm font-semibold tabular-nums shrink-0">{fmtMoney(Number(i.amount))}</span>
            {mode === "admin" ? (
              <Select value={i.status} onValueChange={(v) => updateInvoiceStatus(i.id, v)}>
                <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(INVOICE_STATUS_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Badge variant="outline" className="text-[10px]">{INVOICE_STATUS_LABEL[i.status]}</Badge>
            )}
          </div>
          );
        })}
      </Section>

      <Section icon={<CalendarClock className="h-4 w-4" />} title="Rendez-vous prévus" count={appointments.length}>
        {appointments.length === 0 ? <Empty text="Aucun rendez-vous prévu" /> : appointments.map((a) => (
          <div key={a.id} className="flex items-center justify-between p-3">
            <div className="min-w-0">
              <div className="text-sm truncate">{a.title}</div>
              <div className="text-[11px] text-muted-foreground">
                {fmtDateTime(a.start_at)} · {a.duration_minutes}min{a.location && ` · ${a.location}`}
              </div>
            </div>
            <Badge variant="outline" className="text-[10px]">{a.type}</Badge>
          </div>
        ))}
      </Section>

      <Section icon={<Palette className="h-4 w-4" />} title="Propositions logo" count={logoPresentations.length}>
        {logoPresentations.length === 0 ? <Empty text="Aucune proposition" /> : logoPresentations.map((lp) => {
          const href = mode === "admin"
            ? `/logo/${lp.id}`
            : (lp.is_published && lp.share_token ? `/p/logo/${lp.share_token}` : null);
          const content = (
            <>
              <div className="min-w-0">
                <div className="text-sm truncate">{lp.project_name}</div>
                <div className="text-[11px] text-muted-foreground">
                  Version {lp.version} · MAJ {fmtDate(lp.updated_at)}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {lp.is_published
                  ? <Badge className="bg-emerald-500 hover:bg-emerald-500 text-[10px]">Publiée</Badge>
                  : <Badge variant="outline" className="text-[10px]">Brouillon</Badge>}
                {href && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </div>
            </>
          );
          return href ? (
            <Link key={lp.id} to={href} className="flex items-center justify-between p-3 hover:bg-secondary/60 transition">{content}</Link>
          ) : (
            <div key={lp.id} className="flex items-center justify-between p-3 opacity-70">{content}</div>
          );
        })}
      </Section>

      <Section icon={<HelpCircle className="h-4 w-4" />} title="Questionnaires" count={questionnaires.length}>
        {questionnaires.length === 0 ? <Empty text="Aucun questionnaire" /> : questionnaires.map((q) => {
          const href = mode === "admin"
            ? `/questionnaires/${q.id}`
            : (q.share_token ? `/q/${q.share_token}` : null);
          const label = q.status === "soumis" ? "Envoyé" : q.status === "en_cours" ? "En cours" : "À remplir";
          const variant = q.status === "soumis" ? "bg-emerald-500 hover:bg-emerald-500" : q.status === "en_cours" ? "bg-amber-500 hover:bg-amber-500" : "bg-sky-500 hover:bg-sky-500";
          const content = (
            <>
              <div className="min-w-0">
                <div className="text-sm truncate">{q.title}</div>
                <div className="text-[11px] text-muted-foreground">
                  {q.template ?? "Personnalisé"}
                  {q.submitted_at && ` · soumis ${fmtDate(q.submitted_at)}`}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge className={`${variant} text-[10px]`}>{label}</Badge>
                {href && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </div>
            </>
          );
          return href ? (
            <Link key={q.id} to={href} className="flex items-center justify-between p-3 hover:bg-secondary/60 transition">{content}</Link>
          ) : (
            <div key={q.id} className="flex items-center justify-between p-3 opacity-70">{content}</div>
          );
        })}
      </Section>

      <Section icon={<Sparkles className="h-4 w-4" />} title="Stratégies de marque" count={strategies.length}>
        {strategies.length === 0 ? <Empty text="Aucune stratégie" /> : strategies.map((s) => {
          const href = mode === "admin"
            ? `/strategie/${s.id}`
            : (s.is_published && s.share_token ? `/p/strategie/${s.share_token}` : null);
          const content = (
            <>
              <div className="min-w-0">
                <div className="text-sm truncate">{s.project_name}</div>
                <div className="text-[11px] text-muted-foreground">Version {s.version} · MAJ {fmtDate(s.updated_at)}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {s.is_published
                  ? <Badge className="bg-emerald-500 hover:bg-emerald-500 text-[10px]">Publiée</Badge>
                  : <Badge variant="outline" className="text-[10px]">Brouillon</Badge>}
                {href && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </div>
            </>
          );
          return href ? (
            <Link key={s.id} to={href} className="flex items-center justify-between p-3 hover:bg-secondary/60 transition">{content}</Link>
          ) : (
            <div key={s.id} className="flex items-center justify-between p-3 opacity-70">{content}</div>
          );
        })}
      </Section>
    </div>
  );
}

function Section({ icon, title, count, right, children }: { icon: React.ReactNode; title: string; count: number; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="text-muted-foreground">{icon}</span>
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">({count})</span>
        {right && <div className="ml-auto">{right}</div>}
      </div>
      <Card className="divide-y overflow-hidden">{children}</Card>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-sm text-muted-foreground text-center py-6">{text}</div>;
}