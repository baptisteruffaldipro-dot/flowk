import { Navigate, useParams } from "react-router-dom";
import BrandStrategyEditor from "./BrandStrategyEditor";

export default function BrandStrategy() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to="/strategies" replace />;
  return <BrandStrategyEditor />;
}
