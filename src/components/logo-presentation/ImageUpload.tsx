import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";
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

  const upload = async (file: File) => {
    setBusy(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("logo-presentations").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) {
      toast.error(error.message);
      setBusy(false);
      return;
    }
    const { data } = supabase.storage.from("logo-presentations").getPublicUrl(path);
    onChange(data.publicUrl);
    setBusy(false);
  };

  return (
    <div className={`relative border border-dashed border-border rounded ${aspect} flex items-center justify-center bg-muted/20 overflow-hidden ${className}`}>
      {value ? (
        <>
          <img src={value} alt="" className="w-full h-full object-contain p-2" />
          {onRemove && (
            <Button
              size="icon"
              variant="destructive"
              className="absolute top-1 right-1 h-7 w-7"
              onClick={onRemove}
              type="button"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </>
      ) : (
        <label className="cursor-pointer flex flex-col items-center gap-2 text-xs text-muted-foreground p-4 text-center">
          <Upload className="h-5 w-5" />
          {busy ? "Upload…" : "Choisir une image"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
          />
        </label>
      )}
    </div>
  );
}