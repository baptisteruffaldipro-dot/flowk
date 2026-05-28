import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/AdminLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Tasks from "./pages/Tasks";
import TaskDetail from "./pages/TaskDetail";
import PrintOrders from "./pages/PrintOrders";
import PrintOrderDetail from "./pages/PrintOrderDetail";
import Bats from "./pages/Bats";
import BatDetail from "./pages/BatDetail";
import Invoices from "./pages/Invoices";
import Inbox from "./pages/Inbox";
import Appointments from "./pages/Appointments";
import Realizations from "./pages/Realizations";
import Questionnaires from "./pages/Questionnaires";
import QuestionnaireDetail from "./pages/QuestionnaireDetail";
import QuestionnairePublic from "./pages/QuestionnairePublic";
import TelegramSettings from "./pages/TelegramSettings";
import TiimeSettings from "./pages/TiimeSettings";
import Leads from "./pages/Leads";
import BrandStrategy from "./pages/BrandStrategy";
import BrandStrategies from "./pages/BrandStrategies";
import BrandStrategyPublic from "./pages/BrandStrategyPublic";
import LogoPresentations from "./pages/LogoPresentations";
import LogoPresentation from "./pages/LogoPresentation";
import LogoPresentationPublic from "./pages/LogoPresentationPublic";
import SocialMedia from "./pages/SocialMedia";
import SocialMediaClient from "./pages/SocialMediaClient";
import ClientPortal from "./pages/ClientPortal";
import PortalTokenLanding from "./pages/PortalTokenLanding";
import ClientProjectPortal from "./pages/ClientProjectPortal";
import ClientPrintOrderPortal from "./pages/ClientPrintOrderPortal";
import ClientBatPortal from "./pages/ClientBatPortal";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/q/:token" element={<QuestionnairePublic />} />
            <Route path="/p/strategie/:token" element={<BrandStrategyPublic />} />
            <Route path="/p/logo/:token" element={<LogoPresentationPublic />} />
            <Route path="/p/portail/:token" element={<PortalTokenLanding />} />
            <Route path="/portail" element={<ProtectedRoute requireRole="client"><ClientPortal /></ProtectedRoute>} />
            <Route path="/portail/projet/:id" element={<ProtectedRoute requireRole="client"><ClientProjectPortal /></ProtectedRoute>} />
            <Route path="/portail/impression/:id" element={<ProtectedRoute requireRole="client"><ClientPrintOrderPortal /></ProtectedRoute>} />
            <Route path="/portail/bat/:id" element={<ProtectedRoute requireRole="client"><ClientBatPortal /></ProtectedRoute>} />
            <Route element={<ProtectedRoute requireRole="admin"><AdminLayout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/clients/:id" element={<ClientDetail />} />
              <Route path="/projets" element={<Projects />} />
              <Route path="/projets/:id" element={<ProjectDetail />} />
              <Route path="/taches" element={<Tasks />} />
              <Route path="/taches/:id" element={<TaskDetail />} />
              <Route path="/impressions" element={<PrintOrders />} />
              <Route path="/impressions/:id" element={<PrintOrderDetail />} />
              <Route path="/bats" element={<Bats />} />
              <Route path="/bats/:id" element={<BatDetail />} />
              <Route path="/facturation" element={<Invoices />} />
              <Route path="/inbox" element={<Inbox />} />
              <Route path="/rdv" element={<Appointments />} />
              <Route path="/agenda" element={<Realizations />} />
              <Route path="/questionnaires" element={<Questionnaires />} />
              <Route path="/questionnaires/:id" element={<QuestionnaireDetail />} />
              <Route path="/telegram" element={<TelegramSettings />} />
              <Route path="/parametres/tiime" element={<TiimeSettings />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/strategies" element={<BrandStrategies />} />
              <Route path="/strategie/:id" element={<BrandStrategy />} />
              <Route path="/logos" element={<LogoPresentations />} />
              <Route path="/logo/:id" element={<LogoPresentation />} />
              <Route path="/social" element={<SocialMedia />} />
              <Route path="/social/:clientId" element={<SocialMediaClient />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
