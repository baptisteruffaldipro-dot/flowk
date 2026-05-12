import { Navigate, useParams } from "react-router-dom";
import LogoPresentationEditor from "./LogoPresentationEditor";

export default function LogoPresentation() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to="/logos" replace />;
  return <LogoPresentationEditor />;
}