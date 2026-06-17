import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RefreshCw, Archive, Mail as MailIcon, MailOpen, CornerUpLeft, Forward, ListChecks, FolderKanban, Paperclip, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fmtDateTime } from "@/lib/format";

type Mail = {
  id: string;
  uid: number;
  message_id: string | null;
  thread_key: string | null;
  from_email: string;
  from_name: string | null;
  to_emails: string[];
  cc_emails: string[];
  subject: string | null;
  snippet: string | null;
  body_text: string | null;
  body_html: string | null;
  received_at: string;
  is_read: boolean;
  is_archived: boolean;
  client_id: string | null;
  task_id: string | null;
  project_id: string | null;
};

type Attachment = { id: string; filename: string; mime: string | null; size: number | null; storage_path: string };

export default function Mails() {
  const [mails, setMails] = useState<Mail[]>([]);
  const [selected, setSelected] = useState<Mail | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [tab, setTab] = useState<"unread" | "all" | "archived">("unread");
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [composer, setComposer] = useState<null | { mode: "reply" | "forward" | "new"; mail?: Mail }>(null);
  const [convertOpen, setConvertOpen] = useState<null | "task" | "project">(null);

  const load = async () => {
    let q = supabase.from("mails").select("*").order("received_at", { ascending: false }).limit(200);
    if (tab === "unread") q = q.eq("is_read", false).eq("is_archived", false);
    if (tab === "all") q = q.eq("is_archived", false);
    if (tab === "archived") q = q.eq("is_archived", true);
    const { data, error } = await q;
    if (error) { toast.error(error.message); return; }
    setMails((data || []) as Mail[]);
  };

  useEffect(() => { load(); }, [tab]);

  useEffect(() => {
    const channel = supabase
      .channel("mails-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "mails" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tab]);

  useEffect(() => {
    if (!selected) { setAttachments([]); return; }
    supabase.from("mail_attachments").select("*").eq("mail_id", selected.id)
      .then(({ data }) => setAttachments((data || []) as Attachment[]));
  }, [selected?.id]);

  const filtered = useMemo(() => {
    if (!search.trim()) return mails;
    const s = search.toLowerCase();
    return mails.filter(m =>
      (m.subject || "").toLowerCase().includes(s) ||
      m.from_email.toLowerCase().includes(s) ||
      (m.from_name || "").toLowerCase().includes(s) ||
      (m.snippet || "").toLowerCase().includes(s)
    );
  }, [mails, search]);

  const syncNow = async () => {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("sync-mailbox", { body: {} });
    setSyncing(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${data?.imported ?? 0} nouveau(x) mail(s)`);
    load();
  };

  const openMail = async (m: Mail) => {
    setSelected(m);
    if (!m.is_read) {
      await supabase.functions.invoke("mail-action", { body: { mailId: m.id, action: "mark_read" } });
    }
  };

  const archive = async (m: Mail) => {
    await supabase.functions.invoke("mail-action", { body: { mailId: m.id, action: "archive" } });
    toast.success("Archivé");
    if (selected?.id === m.id) setSelected(null);
    load();
  };

  const toggleRead = async (m: Mail) => {
    await supabase.functions.invoke("mail-action", {
      body: { mailId: m.id, action: m.is_read ? "mark_unread" : "mark_read" },
    });
    load();
  };

  const downloadAttachment = async (att: Attachment) => {
    const { data, error } = await supabase.storage.from("mails").createSignedUrl(att.storage_path, 60);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Boîte mail" subtitle="Centralisé dans l'app" />
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="unread">Non lus</TabsTrigger>
            <TabsTrigger value="all">Boîte</TabsTrigger>
            <TabsTrigger value="archived">Archivés</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={syncNow} disabled={syncing} className="gap-2">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Rafraîchir
          </Button>
          <Button size="sm" onClick={() => setComposer({ mode: "new" })}>Nouveau mail</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
        <Card className="overflow-hidden">
          <div className="divide-y max-h-[calc(100vh-220px)] overflow-y-auto">
            {filtered.length === 0 && (
              <div className="p-6 text-sm text-muted-foreground text-center">Aucun mail</div>
            )}
            {filtered.map((m) => (
              <button
                key={m.id}
                onClick={() => openMail(m)}
                className={`w-full text-left px-3 py-3 hover:bg-secondary/60 transition-colors ${
                  selected?.id === m.id ? "bg-secondary" : ""
                } ${!m.is_read ? "border-l-2 border-l-primary" : ""}`}
              >
                <div className="flex items-baseline gap-2">
                  <span className={`text-sm truncate ${!m.is_read ? "font-semibold" : ""}`}>
                    {m.from_name || m.from_email}
                  </span>
                  <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                    {fmtDateTime(m.received_at)}
                  </span>
                </div>
                <div className={`text-sm truncate ${!m.is_read ? "font-medium" : "text-muted-foreground"}`}>
                  {m.subject || "(sans objet)"}
                </div>
                <div className="text-xs text-muted-foreground truncate">{m.snippet}</div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-4 min-h-[400px]">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Sélectionne un mail
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start gap-2">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold">{selected.subject || "(sans objet)"}</h2>
                  <div className="text-sm text-muted-foreground mt-1">
                    <span className="font-medium">{selected.from_name || selected.from_email}</span>
                    {selected.from_name && <span className="ml-1">&lt;{selected.from_email}&gt;</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    À : {selected.to_emails.join(", ")}
                    {selected.cc_emails.length > 0 && <> · Cc : {selected.cc_emails.join(", ")}</>}
                  </div>
                  <div className="text-xs text-muted-foreground">{fmtDateTime(selected.received_at)}</div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => setComposer({ mode: "reply", mail: selected })}>
                    <CornerUpLeft className="h-4 w-4 mr-1" /> Répondre
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setComposer({ mode: "forward", mail: selected })}>
                    <Forward className="h-4 w-4 mr-1" /> Transférer
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggleRead(selected)}>
                    {selected.is_read ? <MailIcon className="h-4 w-4" /> : <MailOpen className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => archive(selected)}>
                    <Archive className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="secondary" onClick={() => setConvertOpen("task")}>
                  <ListChecks className="h-4 w-4 mr-1" /> Créer une tâche
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setConvertOpen("project")}>
                  <FolderKanban className="h-4 w-4 mr-1" /> Créer un projet
                </Button>
                {selected.task_id && <Badge variant="outline">Tâche liée</Badge>}
                {selected.project_id && <Badge variant="outline">Projet lié</Badge>}
              </div>

              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  {attachments.map(a => (
                    <Button key={a.id} size="sm" variant="outline" onClick={() => downloadAttachment(a)} className="gap-1.5">
                      <Paperclip className="h-3.5 w-3.5" />
                      {a.filename}
                    </Button>
                  ))}
                </div>
              )}

              <div className="border-t pt-4">
                {selected.body_html ? (
                  <div
                    className="prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: sanitize(selected.body_html) }}
                  />
                ) : (
                  <pre className="whitespace-pre-wrap text-sm font-sans">{selected.body_text}</pre>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      {composer && (
        <ComposerDialog
          mode={composer.mode}
          mail={composer.mail}
          onClose={() => setComposer(null)}
        />
      )}
      {convertOpen && selected && (
        <ConvertDialog
          kind={convertOpen}
          mail={selected}
          onClose={() => setConvertOpen(null)}
          onDone={() => { setConvertOpen(null); load(); }}
        />
      )}
    </div>
  );
}

// Basic HTML sanitization: remove scripts and on* attributes
function sanitize(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/ on\w+="[^"]*"/gi, "")
    .replace(/ on\w+='[^']*'/gi, "");
}

function ComposerDialog({ mode, mail, onClose }: { mode: "reply" | "forward" | "new"; mail?: Mail; onClose: () => void }) {
  const [to, setTo] = useState(mode === "reply" ? (mail?.from_email || "") : "");
  const [subject, setSubject] = useState(
    mode === "reply" ? `Re: ${mail?.subject || ""}` :
    mode === "forward" ? `Fwd: ${mail?.subject || ""}` : ""
  );
  const quoted = mail ? `\n\n--- Message original ---\nDe : ${mail.from_email}\nDate : ${mail.received_at}\nObjet : ${mail.subject}\n\n${mail.body_text || ""}` : "";
  const [text, setText] = useState(mode === "new" ? "" : quoted);
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!to || !subject) { toast.error("Destinataire et sujet requis"); return; }
    setSending(true);
    const { error } = await supabase.functions.invoke("send-mail", {
      body: {
        to: to.split(",").map(s => s.trim()).filter(Boolean),
        subject,
        text,
        inReplyTo: mode === "reply" ? mail?.message_id : undefined,
        references: mode === "reply" ? (mail?.thread_key || mail?.message_id) : undefined,
      },
    });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Envoyé");
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "reply" ? "Répondre" : mode === "forward" ? "Transférer" : "Nouveau mail"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>À</Label>
            <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="dest@exemple.com" />
          </div>
          <div>
            <Label>Sujet</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <Label>Message</Label>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={send} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Envoyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConvertDialog({ kind, mail, onClose, onDone }: { kind: "task" | "project"; mail: Mail; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState(mail.subject || "");
  const [description, setDescription] = useState(mail.body_text || mail.snippet || "");
  const [clientId, setClientId] = useState<string>(mail.client_id || "none");
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from("clients").select("id, name").order("name").then(({ data }) => setClients(data || []));
  }, []);

  const submit = async () => {
    setSubmitting(true);
    const cid = clientId === "none" ? null : clientId;
    if (kind === "task") {
      const { data, error } = await supabase
        .from("tasks")
        .insert({ title, description, client_id: cid, status: "a_faire" })
        .select("id")
        .single();
      if (error) { setSubmitting(false); toast.error(error.message); return; }
      await supabase.from("mails").update({ task_id: data.id }).eq("id", mail.id);
      toast.success("Tâche créée");
    } else {
      if (!cid) { setSubmitting(false); toast.error("Client requis pour créer un projet"); return; }
      const { data, error } = await supabase
        .from("projects")
        .insert({ name: title, description, client_id: cid })
        .select("id")
        .single();
      if (error) { setSubmitting(false); toast.error(error.message); return; }
      await supabase.from("mails").update({ project_id: data.id }).eq("id", mail.id);
      toast.success("Projet créé");
    }
    setSubmitting(false);
    onDone();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{kind === "task" ? "Créer une tâche" : "Créer un projet"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Titre</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Aucun —</SelectItem>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submit} disabled={submitting || !title}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}