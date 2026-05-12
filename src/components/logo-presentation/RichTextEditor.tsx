import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter, AlignRight,
  Heading1, Heading2, Heading3, List, ListOrdered, Quote, Undo, Redo,
  Type, StretchHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FontSize, LineHeight } from "./tiptap-extensions";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

const ToolbarBtn = ({
  active, onClick, children, title,
}: { active?: boolean; onClick: () => void; children: React.ReactNode; title?: string }) => (
  <Button
    type="button"
    size="icon"
    variant="ghost"
    title={title}
    onClick={(e) => { e.preventDefault(); onClick(); }}
    className={cn("h-8 w-8", active && "bg-accent text-accent-foreground")}
  >
    {children}
  </Button>
);

function getTextStyleAttrs(editor: Editor) {
  const attrs = editor.getAttributes("textStyle") as Record<string, any>;
  return attrs;
}

function Toolbar({ editor }: { editor: Editor }) {
  const attrs = getTextStyleAttrs(editor);
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 px-1 py-1 rounded-t-md">
      <ToolbarBtn title="Gras" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn title="Italique" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn title="Souligné" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarBtn>
      <span className="w-px h-5 bg-border mx-1" />
      <Select
        value={attrs.fontSize ?? "default"}
        onValueChange={(v) => {
          if (v === "default") (editor.chain().focus() as any).unsetFontSize().run();
          else (editor.chain().focus() as any).setFontSize(v).run();
        }}
      >
        <SelectTrigger className="h-8 w-[72px] text-xs border-0 bg-transparent hover:bg-accent/30 focus:ring-0 px-2 gap-1">
          <Type className="h-3.5 w-3.5 text-muted-foreground" />
          <SelectValue placeholder="Taille" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">Normal</SelectItem>
          {["12px","14px","16px","18px","20px","24px","28px","32px","36px","40px","48px","64px"].map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={attrs.lineHeight ?? "default"}
        onValueChange={(v) => {
          if (v === "default") (editor.chain().focus() as any).unsetLineHeight().run();
          else (editor.chain().focus() as any).setLineHeight(v).run();
        }}
      >
        <SelectTrigger className="h-8 w-[76px] text-xs border-0 bg-transparent hover:bg-accent/30 focus:ring-0 px-2 gap-1">
          <StretchHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          <SelectValue placeholder="Interl." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">Normal</SelectItem>
          {["1","1.2","1.4","1.5","1.6","1.8","2","2.5"].map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="w-px h-5 bg-border mx-1" />
      <ToolbarBtn title="Titre 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1 className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn title="Titre 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn title="Titre 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 className="h-4 w-4" />
      </ToolbarBtn>
      <span className="w-px h-5 bg-border mx-1" />
      <ToolbarBtn title="Aligner à gauche" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
        <AlignLeft className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn title="Centrer" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
        <AlignCenter className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn title="Aligner à droite" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
        <AlignRight className="h-4 w-4" />
      </ToolbarBtn>
      <span className="w-px h-5 bg-border mx-1" />
      <ToolbarBtn title="Liste à puces" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn title="Liste numérotée" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn title="Citation" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="h-4 w-4" />
      </ToolbarBtn>
      <span className="w-px h-5 bg-border mx-1" />
      <ToolbarBtn title="Annuler" onClick={() => editor.chain().focus().undo().run()}>
        <Undo className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn title="Rétablir" onClick={() => editor.chain().focus().redo().run()}>
        <Redo className="h-4 w-4" />
      </ToolbarBtn>
    </div>
  );
}

export default function RichTextEditor({ value, onChange, placeholder, minHeight = "180px" }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      FontSize,
      LineHeight,
    ],
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none px-3 py-3",
        style: `min-height:${minHeight}`,
        "data-placeholder": placeholder ?? "",
      },
    },
  });

  // Sync external changes (e.g., loading a different document)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if ((value || "") !== current) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="border rounded-md bg-background">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}