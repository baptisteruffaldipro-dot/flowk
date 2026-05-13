import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  value?: string;
  format?: string;
  onChange: (url: string, format: string) => void;
  onRemove?: () => void;
  folder: string;
}

const formatFromExt = (ext: string): string => {
  const e = ext.toLowerCase();
  if (e === "ttf") return "truetype";
  if (e === "otf") return "opentype";
  if (e === "woff") return "woff";
  if (e === "woff2") return "woff2";
  return "truetype";
};

export default function FontUpload({ value, format, onChange, onRemove, folder }: Props) {
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    const ext = (file.name.split(".").pop() || "ttf").toLowerCase();
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("logo-presentations").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || `font/${ext}`,
    });
    if (error) {
      toast.error(error.message);
      setBusy(false);
      return;
    }
    const { data } = supabase.storage.from("logo-presentations").getPublicUrl(path);
    onChange(data.publicUrl, formatFromExt(ext));
    setBusy(false);
  };

  if (value) {
    const filename = value.split("/").pop() || "police";
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-2 border border-border rounded bg-muted/20 text-xs">
        <span className="truncate">
          🅰 {decodeURIComponent(filename)} <span className="text-muted-foreground">({format || "?"})</span>
        </span>
        {onRemove && (
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onRemove} type="button">
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <label className="flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-border rounded cursor-pointer text-xs text-muted-foreground hover:bg-muted/30">
      <Upload className="h-3.5 w-3.5" />
      {busy ? "Upload…" : "Importer un fichier de police (.ttf, .otf, .woff, .woff2)"}
      <input
        type="file"
        accept=".ttf,.otf,.woff,.woff2,font/*"
        className="hidden"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
        }}
      />
    </label>
  );
}