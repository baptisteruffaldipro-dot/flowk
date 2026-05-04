import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Plus } from "lucide-react";
import { toast } from "sonner";

type ClientLite = { id: string; name: string; company?: string | null };

const NEW_VALUE = "__new_client__";

export default function ClientSelectField({
  value,
  onChange,
  clients,
  onClientCreated,
  placeholder = "—",
  disabled = false,
  showCompany = false,
}: {
  value: string;
  onChange: (id: string) => void;
  clients: ClientLite[];
  onClientCreated: (client: ClientLite) => void;
  placeholder?: string;
  disabled?: boolean;
  showCompany?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", company: "", email: "", phone: "" });
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!form.name.trim()) return toast.error("Nom requis");
    setBusy(true);
    const { data, error } = await supabase
      .from("clients")
      .insert({
        name: form.name.trim(),
        company: form.company.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
      })
      .select("id,name,company")
      .single();
    setBusy(false);
    if (error || !data) return toast.error(error?.message || "Erreur");
    toast.success("Client créé");
    onClientCreated(data as ClientLite);
    onChange(data.id);
    setForm({ name: "", company: "", email: "", phone: "" });
    setOpen(false);
  };

  return (
    <>
      <div className="flex gap-1.5">
        <Select
          value={value || undefined}
          onValueChange={(v) => {
            if (v === NEW_VALUE) { setOpen(true); return; }
            onChange(v);
          }}
          disabled={disabled}
        >
          <SelectTrigger className="flex-1 min-w-0"><SelectValue placeholder={placeholder} /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NEW_VALUE} className="text-primary font-medium">
              <span className="inline-flex items-center gap-1.5">
                <UserPlus className="h-3.5 w-3.5" /> Nouveau client…
              </span>
            </SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}{showCompany && c.company ? ` — ${c.company}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          onClick={() => setOpen(true)}
          disabled={disabled}
          title="Créer un nouveau client"
        >
          <UserPlus className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader><DialogTitle>Nouveau client</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nom *</Label>
              <Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Société</Label>
              <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Téléphone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={create} disabled={busy}>
              <Plus className="h-4 w-4 mr-1" />Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
