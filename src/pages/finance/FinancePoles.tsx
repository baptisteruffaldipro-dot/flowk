import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import FinanceNav from "@/components/finance/FinanceNav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FinanceUnits from "./FinanceUnits";
import FinanceRecurring from "./FinanceRecurring";
import FinanceGoals from "./FinanceGoals";
import FinanceProfitability from "./FinanceProfitability";
import FinanceForecasts from "./FinanceForecasts";
import FinanceReports from "./FinanceReports";

/** Tout ce qui concerne les pôles d'activité, regroupé en onglets. */
export default function FinancePoles() {
  const [tab, setTab] = useState("poles");
  return (
    <div className="p-6 md:p-8">
      <PageHeader title="Pôles d'activité" description="Comparatif, frais fixes récurrents, objectifs, rentabilité et prévisions." />
      <FinanceNav />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 flex-wrap h-auto">
          <TabsTrigger value="poles">Comparatif</TabsTrigger>
          <TabsTrigger value="recurrents">Frais fixes & récurrents</TabsTrigger>
          <TabsTrigger value="objectifs">Objectifs & règles</TabsTrigger>
          <TabsTrigger value="rentabilite">Rentabilité</TabsTrigger>
          <TabsTrigger value="previsions">Prévisions</TabsTrigger>
          <TabsTrigger value="rapports">Rapports</TabsTrigger>
        </TabsList>
        <TabsContent value="poles"><FinanceUnits embedded /></TabsContent>
        <TabsContent value="recurrents"><FinanceRecurring embedded /></TabsContent>
        <TabsContent value="objectifs"><FinanceGoals embedded /></TabsContent>
        <TabsContent value="rentabilite"><FinanceProfitability embedded /></TabsContent>
        <TabsContent value="previsions"><FinanceForecasts embedded /></TabsContent>
        <TabsContent value="rapports"><FinanceReports embedded /></TabsContent>
      </Tabs>
    </div>
  );
}
