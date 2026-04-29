import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function ProtectedRoute({
  children,
  requireRole,
}: {
  children: JSX.Element;
  requireRole?: "admin" | "client";
}) {
  const { user, role, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Chargement…
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (requireRole && role !== requireRole) {
    return <Navigate to={role === "client" ? "/portail" : "/"} replace />;
  }
  return children;
}