import { useCallback, useEffect, useState } from "react";
import { MessageCircle, RefreshCw, Send, ThumbsDown, ThumbsUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { fmtDateTime } from "@/lib/format";
import type { MoodboardReactions } from "@/lib/moodboardReactions";
import { toast } from "sonner";

type Kind = "brand_strategy" | "logo_presentation";
type Message = { id: string; author: string; body: string; created_at: string };
type Props = { kind: Kind; presentationId: string; token?: string; clientName?: string };

export default function PresentationExchange({ kind, presentationId, token, clientName }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<MoodboardReactions>({});
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(false);
  const column = kind === "brand_strategy" ? "brand_strategy_id" : "logo_presentation_id";

  const load = useCallback(async () => {
    try {
      if (token) {
        const { data, error: err } = await supabase.rpc("presentation_exchange_by_token", { _kind: kind, _token: token });
        if (err) throw err;
        const result = data as unknown as { messages: Message[]; reactions: MoodboardReactions };
        setMessages(result.messages);
        setReactions(result.reactions);
      } else {
        const { data, error: err } = await supabase.from("presentation_messages").select("id,author,body,created_at").eq(column, presentationId).order("created_at").order("id");
        if (err) throw err;
        setMessages(data ?? []);
        if (kind === "logo_presentation") {
          const { data: logo, error: logoError } = await supabase.from("logo_presentations").select("client_selections").eq("id", presentationId).single();
          if (logoError) throw logoError;
          setReactions((logo.client_selections ?? {}) as MoodboardReactions);
        }
      }
      setError(false);
    } catch { setError(true); }
    finally { setLoading(false); }
  }, [kind, token, presentationId, column]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 15000);
    const refresh = () => { void load(); };
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [load]);

  const send = async () => {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const result = token
        ? await supabase.rpc("presentation_add_message_by_token", { _kind: kind, _token: token, _body: text })
        : await supabase.from("presentation_messages").insert({
            brand_strategy_id: kind === "brand_strategy" ? presentationId : null,
            logo_presentation_id: kind === "logo_presentation" ? presentationId : null,
            author: "studio", body: text,
          });
      if (result.error) throw result.error;
      setBody("");
      await load();
      toast.success("Message envoyé");
    } catch { toast.error("Le message n’a pas pu être envoyé. Réessayez."); }
    finally { setSending(false); }
  };

  const content = (
    <div className="space-y-4 min-w-0">
      {!token && Object.keys(reactions).length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Références du moodboard · {clientName || "Client"}</h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {Object.entries(reactions).map(([url, reaction]) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="shrink-0 w-28 space-y-1 text-xs text-muted-foreground">
                <img src={url} alt="Référence du moodboard" className="w-28 h-24 object-contain bg-muted rounded border" />
                <span className="flex items-center gap-1">{reaction === "like" ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}{reaction === "like" ? "J’aime" : "J’aime pas"}</span>
              </a>
            ))}
          </div>
        </div>
      )}
      <div role="log" aria-label="Messages de la présentation" aria-live="polite" className="max-h-80 overflow-y-auto space-y-3">
        {loading ? <p className="text-sm text-muted-foreground">Chargement…</p> : error ? (
          <p role="alert" className="text-sm text-destructive">Les échanges n’ont pas pu être chargés.</p>
        ) : messages.length === 0 ? <p className="text-sm text-muted-foreground">Aucun échange pour le moment.</p> : messages.map(message => (
          <div key={message.id} className={`rounded border p-3 ${message.author === "studio" ? "bg-muted/50" : "bg-background"}`}>
            <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs mb-2">
              <span className="font-medium">{message.author === "studio" ? "Studio" : clientName || "Client"}</span>
              <time className="text-muted-foreground" dateTime={message.created_at}>{fmtDateTime(message.created_at)}</time>
            </div>
            <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
          </div>
        ))}
      </div>
      <form onSubmit={e => { e.preventDefault(); void send(); }} className="space-y-2">
        <Textarea aria-label="Votre message" placeholder={token ? "Votre retour…" : "Répondre au client…"} rows={3} maxLength={4000} value={body} onChange={e => setBody(e.target.value)} disabled={sending} />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={!body.trim() || sending || loading || error}><Send className="h-4 w-4 mr-2" />{sending ? "Envoi…" : "Envoyer"}</Button>
        </div>
      </form>
    </div>
  );

  if (token) return (
    <Dialog open={open} onOpenChange={value => { setOpen(value); if (value) void load(); }}>
      <DialogTrigger asChild><Button className="fixed bottom-6 right-4 sm:right-6 z-40 shadow-lg gap-2"><MessageCircle className="h-4 w-4" />Échanges{messages.length > 0 && <span>({messages.length})</span>}</Button></DialogTrigger>
      <DialogContent className="max-w-xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Échanges · {clientName || "Présentation"}</DialogTitle></DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );

  return (
    <section aria-label="Échanges" className="mt-6 border rounded-md p-4 sm:p-5 bg-card">
      <div className="flex justify-between items-center mb-4">
        <h2 className="flex items-center gap-2 font-semibold"><MessageCircle className="h-4 w-4" />Échanges{messages.length > 0 && <span className="text-muted-foreground text-sm">({messages.length})</span>}</h2>
        <Button variant="ghost" size="icon" aria-label="Actualiser les échanges" title="Actualiser les échanges" onClick={() => void load()}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      {content}
    </section>
  );
}