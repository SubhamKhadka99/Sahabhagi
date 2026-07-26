import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import LandingPage from "./pages/LandingPage";
import CitizenApp from "./pages/CitizenApp";
import AdminDashboard from "./pages/AdminDashboard";

function Spinner() {
  return (
    <div className="min-h-screen bg-[#0A192F] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-[#00B4D8] border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Loading SahaBhagi…</p>
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireOfficer({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "citizen") return <Navigate to="/app" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;

  return (
    <Routes>
      {/* Public marketing landing page. Logged-in visitors get bounced
          straight to their dashboard instead of seeing the pitch again. */}
      <Route
        path="/"
        element={user ? <Navigate to={user.role === "citizen" ? "/app" : "/admin"} replace /> : <LandingPage />}
      />
      <Route
        path="/login"
        element={user ? <Navigate to={user.role === "citizen" ? "/app" : "/admin"} replace /> : <Login />}
      />
      <Route path="/app" element={<RequireAuth><CitizenApp /></RequireAuth>} />
      <Route path="/admin" element={<RequireOfficer><AdminDashboard /></RequireOfficer>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
