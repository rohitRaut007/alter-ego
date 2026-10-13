import { Navigate, Route, Routes, useSearchParams } from "react-router-dom";

import { Spinner } from "@/components/primitives";
import { CharacterPage } from "@/features/character/CharacterPage";
import { DailyPage } from "@/features/daily/DailyPage";
import { InterviewPage } from "@/features/onboarding/InterviewPage";
import { PlanPage } from "@/features/plan/PlanPage";
import { ProtocolPage } from "@/features/protocol/ProtocolPage";
import { ReflectionPage } from "@/features/reflection/ReflectionPage";
import { RitualPage } from "@/features/ritual/RitualPage";
import { useAuth } from "@/lib/auth";
import { AuthPage } from "@/pages/AuthPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { KnowledgePage } from "@/pages/KnowledgePage";
import { LandingPage } from "@/pages/LandingPage";
import { LegacyPage } from "@/pages/LegacyPage";
import { MentorPage } from "@/pages/MentorPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PersonalityPage } from "@/pages/PersonalityPage";
import { SettingsPage } from "@/pages/SettingsPage";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  if (status === "loading") return <Spinner label="Restoring your session" />;
  if (status === "signedOut") return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AuthRoute() {
  const [params] = useSearchParams();
  return <AuthPage initialMode={params.get("mode") === "signup" ? "signup" : "signin"} />;
}

const guard = (el: React.ReactNode) => <RequireAuth>{el}</RequireAuth>;

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<AuthRoute />} />
      <Route path="/login" element={<Navigate to="/auth" replace />} />
      <Route path="/register" element={<Navigate to="/auth?mode=signup" replace />} />

      <Route path="/onboarding" element={guard(<InterviewPage />)} />
      <Route path="/personality" element={guard(<PersonalityPage />)} />
      <Route path="/dashboard" element={guard(<DashboardPage />)} />
      <Route path="/daily" element={guard(<DailyPage />)} />
      <Route path="/today" element={<Navigate to="/daily" replace />} />
      <Route path="/plan" element={guard(<PlanPage />)} />
      <Route path="/reflection" element={guard(<ReflectionPage />)} />
      <Route path="/ritual" element={guard(<RitualPage />)} />
      <Route path="/protocol" element={guard(<ProtocolPage />)} />
      <Route path="/protocol/:id" element={guard(<ProtocolPage />)} />
      <Route path="/mentor" element={guard(<MentorPage />)} />
      <Route path="/character" element={guard(<CharacterPage />)} />
      <Route path="/knowledge" element={guard(<KnowledgePage />)} />
      <Route path="/legacy" element={guard(<LegacyPage />)} />
      <Route path="/settings" element={guard(<SettingsPage />)} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
