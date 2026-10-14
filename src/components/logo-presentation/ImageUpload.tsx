import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  value?: string;
  onChange: (url: string) => void;
  onRemove?: () => void;
  folder: string; // path within bucket
  className?: string;
  aspect?: string; // tailwind aspect class
}

export default function ImageUpload({ value, onChange, onRemove, folder, className = "", aspect = "aspect-square" }: Props) {
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/") && !/\.(png|jpe?g|gif|webp|svg|avif)$/i.test(file.name)) {
      toast.error("Ce fichier n'est pas une image (PNG, JPG, WEBP, SVG…)");
      return;
    }
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("logo-presentations").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });
      if (error) {
        toast.error(`Envoi impossible : ${error.message}`);
        return;
      }
      const { data } = supabase.storage.from("logo-presentations").getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("Visuel ajouté — pense à enregistrer");
    } catch (e: any) {
      toast.error(`Envoi impossible : ${e?.message || "erreur inconnue"}`);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const openPicker = () => {
    if (!busy) inputRef.current?.click();
  };

  return (
    <div
      className={`relative border border-dashed rounded ${aspect} flex items-center justify-center overflow-hidden transition-colors ${
        over ? "border-primary bg-primary/10" : "border-border bg-muted/20"
      } ${!value ? "cursor-pointer hover:bg-muted/40" : ""} ${className}`}
      onClick={() => { if (!value) openPicker(); }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) upload(f);
      }}
      role={!value ? "button" : undefined}
      aria-label={!value ? "Choisir une image" : undefined}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={busy}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
        }}
      />
      {value ? (
        <>
          <img src={value} alt="" className="w-full h-full object-contain p-2" />
          <Button
            size="sm"
            variant="secondary"
            className="absolute bottom-1 right-1 h-7 text-xs"
            onClick={(e) => { e.stopPropagation(); openPicker(); }}
            type="button"
          >
            Remplacer
          </Button>
          {onRemove && (
            <Button
              size="icon"
              variant="destructive"
              className="absolute top-1 right-1 h-7 w-7"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              type="button"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </>
      ) : (
        <div className="pointer-events-none flex flex-col items-center gap-2 text-xs text-muted-foreground p-4 text-center">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
          {busy ? "Envoi en cours…" : "Cliquer ou glisser une image"}
        </div>
      )}
    </div>
  );
}
