import { AppShell, PageHeader } from "@/components/AppShell";
import { useLanguage } from "@/lib/i18n";

import { ReflectionForm } from "./ReflectionForm";

export function ReflectionPage() {
  const { t } = useLanguage();
  return (
    <AppShell>
      <PageHeader
        eyebrow={t("reflection_eyebrow", "End of day · about five minutes")}
        title={t("reflection_title", "Evening reflection")}
      />
      <div className="card-surface max-w-2xl p-6">
        <ReflectionForm />
      </div>
    </AppShell>
  );
}
