import { Navigate, Outlet } from "react-router-dom";
import { getSessionRole } from "@/lib/session";

type ProtectedRouteProps = {
  allowedRoles?: Array<"admin" | "worker">;
};

export const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
  const token = localStorage.getItem("CivicResource_token") || localStorage.getItem("CivicFlow_token");
  const sessionRole = getSessionRole();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && sessionRole && !allowedRoles.includes(sessionRole)) {
    return <Navigate to={sessionRole === "admin" ? "/app" : "/app/driver"} replace />;
  }

  if (allowedRoles && !sessionRole) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
