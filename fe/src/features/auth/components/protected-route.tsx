// src/features/auth/components/ProtectedRoute.tsx
import React, { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/auth-hook";
import authService from "../services/auth-service";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "customer" | "staff" | "admin" | "management";
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
}) => {
  const { state, loadUser } = useAuth();
  const location = useLocation();

  // Thêm effect để kiểm tra token khi component mount
  useEffect(() => {
    if (
      authService.isAuthenticated() &&
      !state.isAuthenticated &&
      !state.loading
    ) {
      loadUser();
    }
  }, [state.isAuthenticated, state.loading, loadUser]);

  if (state.loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!state.isAuthenticated) {
    // Sửa thành redirect đến "/auth/login" thay vì "/auth"
    return (
      <Navigate
        to={`/auth/login?redirect=${encodeURIComponent(
          location.pathname + location.search
        )}`}
        state={{ from: location }}
        replace
      />
    );
  }

  // Thêm kiểm tra state.user tồn tại trước khi kiểm tra role
  if (
    requiredRole &&
    (!state.user ||
      (requiredRole === "management"
        ? !["admin", "staff"].includes(state.user.role)
        : state.user.role !== requiredRole))
  ) {
    return <Navigate to="/shop" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
