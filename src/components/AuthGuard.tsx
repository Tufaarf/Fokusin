import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { isSessionExpired } from "../hooks/useAutoLogout";
import { useAppStore } from "../store";

export function AuthGuard() {
  const currentUser = useAppStore((state) => state.currentUser);
  const logout = useAppStore((state) => state.logout);
  const location = useLocation();

  useEffect(() => {
    // Tangani event unauthorized (401) dari API client
    const handleUnauthorized = () => {
      logout();
    };
    window.addEventListener("fokusin:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("fokusin:unauthorized", handleUnauthorized);
    };
  }, [logout]);

  if (!currentUser || isSessionExpired()) {
    if (currentUser && isSessionExpired()) {
      logout();
    }
    return (
      <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
    );
  }

  return <Outlet />;
}

