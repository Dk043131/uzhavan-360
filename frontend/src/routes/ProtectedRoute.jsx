import { Navigate, useLocation } from "react-router-dom";
import { useAuth, homeFor } from "@/context/AuthContext";

export function ProtectedRoute({ roles, children }) {
  const { user, restoring } = useAuth();
  const location = useLocation();
  if (restoring) return <div className="state-box" data-testid="session-restoring"><div className="spinner" /><p>Restoring your session...</p></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="state-box error-state" data-testid="forbidden-state">
        <div className="state-icon">403</div>
        <h2>This area isn’t available for your account</h2>
        <p>Your role is {user.role.replace("ROLE_", "").toLowerCase()}. <a href={homeFor(user.role)}>Go to your home</a>.</p>
      </div>
    );
  }
  return children;
}
