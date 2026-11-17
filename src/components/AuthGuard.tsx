import { Navigate, Outlet, useLocation } from "react-router";
import { useAppStore } from "../store";

export function AuthGuard() {
  const currentUser = useAppStore((state) => state.currentUser);
  const location = useLocation();

  if (!currentUser) {
    return (
      <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
    );
  }

  return <Outlet />;
}
