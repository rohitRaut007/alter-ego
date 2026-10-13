import { Navigate, Route, Routes } from "react-router-dom";

import { Spinner } from "@/components/ui";
import { CharacterPage } from "@/features/character/CharacterPage";
import { InterviewPage } from "@/features/onboarding/InterviewPage";
import { PlanPage } from "@/features/plan/PlanPage";
import { ProtocolPage } from "@/features/protocol/ProtocolPage";
import { ReflectionPage } from "@/features/reflection/ReflectionPage";
import { RitualPage } from "@/features/ritual/RitualPage";
import { TodayPage } from "@/features/today/TodayPage";
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
      <Route path="/today" element={<RequireAuth><TodayPage /></RequireAuth>} />
      <Route path="/plan" element={<RequireAuth><PlanPage /></RequireAuth>} />
      <Route path="/character" element={<RequireAuth><CharacterPage /></RequireAuth>} />
      <Route path="/reflection" element={<RequireAuth><ReflectionPage /></RequireAuth>} />
      <Route path="/ritual" element={<RequireAuth><RitualPage /></RequireAuth>} />
      <Route path="/onboarding" element={<RequireAuth><InterviewPage /></RequireAuth>} />
      <Route path="/protocol" element={<RequireAuth><ProtocolPage /></RequireAuth>} />
      <Route path="/protocol/:id" element={<RequireAuth><ProtocolPage /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
