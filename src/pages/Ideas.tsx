import PageHeader from "@/components/PageHeader";
import IdeasBoard from "@/components/IdeasBoard";

export default function Ideas() {
  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto">
      <PageHeader
        title="Idées / Notes"
        description="Notes rapides, inspirations et images — liables à un projet ou une tâche"
      />
      <IdeasBoard showGlobal title="Toutes les notes" />
    </div>
  );
}
