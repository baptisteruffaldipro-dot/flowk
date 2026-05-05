import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Check, Plus, X } from "lucide-react";
import { PRESTATION_LABEL, tagColor } from "@/lib/format";

/**
 * Sélecteur multi-prestations.
 * Affiche les prestations sélectionnées sous forme de chips et permet d'en ajouter / retirer.
 */
export default function PrestationPicker({
  value,
  onChange,
  size = "md",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const selected = new Set(value ?? []);
  const entries = Object.entries(PRESTATION_LABEL);
  const filtered = q
    ? entries.filter(([, label]) => (label as string).toLowerCase().includes(q.toLowerCase()))
    : entries;

  const qTrim = q.trim();
  const existsInList = entries.some(
    ([key, label]) =>
      (label as string).toLowerCase() === qTrim.toLowerCase() ||
      key.toLowerCase() === qTrim.toLowerCase()
  );
  const alreadySelected = (value ?? []).some((k) => k.toLowerCase() === qTrim.toLowerCase());
  const canAddCustom = qTrim.length > 0 && !existsInList && !alreadySelected;

  const addCustom = () => {
    if (!canAddCustom) return;
    onChange([...(value ?? []), qTrim]);
    setQ("");
  };

  const toggle = (key: string) => {
    const next = selected.has(key)
      ? (value ?? []).filter((k) => k !== key)
      : [...(value ?? []), key];
    onChange(next);
  };

  const remove = (key: string) => onChange((value ?? []).filter((k) => k !== key));

  const chipClass = size === "sm" ? "text-[10px] px-1.5 py-0" : "text-[11px] px-2 py-0.5";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {(value ?? []).map((k) => (
        <Badge
          key={k}
          variant="outline"
          className={`${chipClass} ${tagColor(k)} inline-flex items-center gap-1`}
        >
          {PRESTATION_LABEL[k] ?? k}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); remove(k); }}
            className="hover:opacity-70"
            aria-label="Retirer"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </Badge>
      ))}
      <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQ(""); }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 border border-dashed border-border rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition"
          >
            <Plus className="h-3 w-3" /> Prestation
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-1" align="start">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canAddCustom) {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder="Rechercher ou ajouter…"
            className="h-8 mb-1 text-xs"
            autoFocus
          />
          <div className="max-h-72 overflow-y-auto">
            {filtered.map(([key, label]) => {
              const active = selected.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggle(key)}
                  className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent inline-flex items-center justify-between gap-2 ${active ? "bg-accent/60 font-medium" : ""}`}
                >
                  <span className="truncate">{label as string}</span>
                  {active && <Check className="h-3 w-3 text-primary shrink-0" />}
                </button>
              );
            })}
            {filtered.length === 0 && !canAddCustom && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">Aucun résultat</div>
            )}
            {canAddCustom && (
              <button
                type="button"
                onClick={addCustom}
                className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent inline-flex items-center gap-2 border-t mt-1 pt-2 text-primary"
              >
                <Plus className="h-3 w-3" /> Ajouter « {qTrim} »
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}