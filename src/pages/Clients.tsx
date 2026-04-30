import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

type Client = { id: string; name: string; company: string | null; email: string | null; phone: string | null };

const schema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(120),
  company: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().email("Email invalide").max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", company: "", email: "", phone: "", address: "", notes: "" });

  const load = async () => {
    const { data } = await supabase.from("clients").select("id,name,company,email,phone").order("name");
    setClients((data as any) ?? []);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    const { error } = await supabase.from("clients").insert({
      name: parsed.data.name,
      company: parsed.data.company || null,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      notes: parsed.data.notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Client ajouté");
    setForm({ name: "", company: "", email: "", phone: "", address: "", notes: "" });
    setOpen(false);
    load();
  };

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto">
      <PageHeader
        title="Clients"
        description={`${clients.length} client${clients.length > 1 ? "s" : ""}`}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nouveau client</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nouveau client</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Field label="Nom *"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                <Field label="Société"><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                  <Field label="Téléphone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
                </div>
                <Field label="Adresse"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
              </div>
              <DialogFooter><Button onClick={create}>Créer</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="overflow-hidden">
        {clients.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Aucun client. Crée ton premier client.</div>
        ) : (
          <div className="divide-y">
            {clients.map((c) => (
              <Link key={c.id} to={`/clients/${c.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-secondary/40 transition">
                <div>
                  <div className="font-medium">{c.name}</div>
                  {c.company && <div className="text-xs text-muted-foreground">{c.company}</div>}
                </div>
                <div className="text-sm text-muted-foreground">{c.email}</div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}