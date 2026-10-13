import { Navigate, Route, Routes } from "react-router-dom";

import { Spinner } from "@/components/ui";
import { InterviewPage } from "@/features/onboarding/InterviewPage";
import { ProtocolPage } from "@/features/protocol/ProtocolPage";
import { useAuth } from "@/lib/auth";
import { LoginPage, RegisterPage } from "@/pages/AuthPages";
import { HomePage } from "@/pages/HomePage";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  if (status === "loading") return <Spinner label="Restoring your session" />;
  if (status === "signedOut") return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
      <Route path="/onboarding" element={<RequireAuth><InterviewPage /></RequireAuth>} />
      <Route path="/protocol" element={<RequireAuth><ProtocolPage /></RequireAuth>} />
      <Route path="/protocol/:id" element={<RequireAuth><ProtocolPage /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
