import { useState, KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { X } from "lucide-react";
import { QSection, QField } from "@/lib/questionnaireTemplates";

interface Props {
  sections: QSection[];
  values: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
  disabled?: boolean;
}

function TagInput({ value, onChange, max, disabled }: { value: string[]; onChange: (v: string[]) => void; max?: number; disabled?: boolean }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (max && value.length >= max) return;
    onChange([...value, v]);
    setDraft("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add();
    }
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((t, i) => (
          <Badge key={i} variant="secondary" className="gap-1">
            {t}
            {!disabled && (
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}
      </div>
      {!disabled && (!max || value.length < max) && (
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            placeholder={max ? `${value.length}/${max} — Entrée pour ajouter` : "Entrée pour ajouter"}
          />
          <Button type="button" variant="secondary" onClick={add}>Ajouter</Button>
        </div>
      )}
    </div>
  );
}

function FieldRender({ field, value, onChange, disabled }: { field: QField; value: any; onChange: (v: any) => void; disabled?: boolean }) {
  if (field.type === "textarea") {
    return <Textarea rows={4} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} disabled={disabled} />;
  }
  if (field.type === "tags") {
    return <TagInput value={Array.isArray(value) ? value : []} onChange={onChange} max={field.max} disabled={disabled} />;
  }
  if (field.type === "multiselect") {
    const selected: string[] = Array.isArray(value) ? value : [];
    const toggle = (opt: string) => {
      if (selected.includes(opt)) onChange(selected.filter((s) => s !== opt));
      else onChange([...selected, opt]);
    };
    return (
      <div className="grid sm:grid-cols-2 gap-2">
        {field.options?.map((o) => {
          const checked = selected.includes(o);
          return (
            <label
              key={o}
              className={`flex items-center gap-2 rounded-md border p-2.5 cursor-pointer transition ${checked ? "border-primary bg-primary/5" : "hover:bg-secondary/50"} ${disabled ? "opacity-60 pointer-events-none" : ""}`}
            >
              <Checkbox checked={checked} onCheckedChange={() => toggle(o)} disabled={disabled} />
              <span className="text-sm">{o}</span>
            </label>
          );
        })}
      </div>
    );
  }
  if (field.type === "select") {
    return (
      <Select value={value ?? ""} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
        <SelectContent>
          {field.options?.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }
  return <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} disabled={disabled} />;
}

export default function QuestionnaireForm({ sections, values, onChange, disabled }: Props) {
  const setField = (key: string, v: any) => onChange({ ...values, [key]: v });
  return (
    <div className="space-y-8">
      {sections.map((section, idx) => (
        <section key={idx} className="space-y-4">
          <div>
            <h3 className="text-base font-semibold">{section.title}</h3>
            {section.description && (
              <p className="text-sm text-muted-foreground mt-1">{section.description}</p>
            )}
          </div>
          <div className="space-y-4">
            {section.fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label>{f.label}</Label>
                {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
                <FieldRender field={f} value={values[f.key]} onChange={(v) => setField(f.key, v)} disabled={disabled} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}