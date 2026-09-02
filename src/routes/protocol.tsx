import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  Fingerprint,
  Flag,
  Sparkles,
  Sun,
  Target,
  UserCog,
} from "lucide-react";
import { useState } from "react";

import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/lib/i18n";
import { layers, profile, type Layer } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/protocol")({
  head: () => ({
    meta: [
      { title: "Seven-Layer Protocol — Alter Ego OS" },
      {
        name: "description",
        content:
          "Identity architecture, character stack, knowledge system, mission strategy, daily OS, presence and legacy — your full protocol.",
      },
      { property: "og:title", content: "Seven-Layer Protocol — Alter Ego OS" },
      {
        property: "og:description",
        content: "Every layer of your personal operating system, in one place.",
      },
    ],
  }),
  component: Protocol,
});

const icons = [Fingerprint, UserCog, BookOpen, Target, Sun, Sparkles, Flag];
const layerLinks: Record<string, "/character" | "/knowledge" | "/daily" | "/legacy" | "/mentor"> = {
  character: "/character",
  knowledge: "/knowledge",
  "daily-os": "/daily",
  legacy: "/legacy",
};

function Protocol() {
  const { t } = useLanguage();
  const [open, setOpen] = useState<Layer | null>(null);
  const average = Math.round(layers.reduce((a, l) => a + l.progress, 0) / layers.length);

  return (
    <AppShell>
      <PageHeader
        eyebrow={t("protocol_main_title", "The protocol")}
        title={t("protocol_title", "Seven layers, one coherent person.")}
        description={t("protocol_layers_description", "Each layer inherits from the one above it. Open a layer to see what it's made of.")}
      />

      <section className="card-surface rise-in mb-6 flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="label-eyebrow">{t("protocol_identity_statement", "Identity statement")}</p>
          <p className="mt-2 max-w-xl font-display text-2xl leading-snug sm:text-3xl">
            “{t("profile_identity_statement_val", profile.identityStatement)}”
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            {t("profile_alter_ego_val", profile.alterEgo)} · {t("profile_archetype_val", profile.archetype)} · {t("profile_timeline_val", profile.timeline)} horizon
          </p>
        </div>
        <div className="shrink-0 text-center">
          <p className="font-display text-5xl">{average}%</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("protocol_built", "protocol built")}</p>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {layers.map((layer, i) => {
          const Icon = icons[i] ?? Sparkles;
          return (
            <button
              key={layer.id}
              onClick={() => setOpen(layer)}
              className="card-surface group p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
            >
              <div className="flex items-start justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <Icon className="size-[18px]" />
                </span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    layer.status === "locked-in"
                      ? "bg-success/10 text-success"
                      : layer.status === "active"
                        ? "bg-accent-soft text-accent"
                        : "bg-secondary text-muted-foreground",
                  )}
                >
                  {t(`status_${layer.status.replace("-", "_")}`, layer.status)}
                </span>
              </div>
              <p className="mt-5 font-mono text-[11px] text-muted-foreground">
                {t("protocol_layer_label", "Layer")} 0{layer.index}
              </p>
              <h2 className="mt-1 text-xl">{t(`layer_${layer.id.replace("-", "_")}_name`, layer.name)}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(`layer_${layer.id.replace("-", "_")}_tagline`, layer.tagline)}</p>
              <Progress value={layer.progress} className="mt-5 h-1" />
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{layer.progress}% {t("protocol_percent_built", "built")}</span>
                <span className="flex items-center gap-1 transition-transform group-hover:translate-x-0.5">
                  {t("protocol_open", "Open")} <ArrowRight className="size-3" />
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-lg">
          {open && (
            <>
              <DialogHeader>
                <p className="label-eyebrow">{t("protocol_layer_label", "Layer")} 0{open.index}</p>
                <DialogTitle className="font-display text-2xl font-normal">{t(`layer_${open.id.replace("-", "_")}_name`, open.name)}</DialogTitle>
                <DialogDescription className="leading-relaxed">
                  {t(`layer_${open.id.replace("-", "_")}_desc`, open.description)}
                </DialogDescription>
              </DialogHeader>
              <Progress value={open.progress} className="h-1.5" />
              <ul className="space-y-2">
                {open.highlights.map((h, idx) => (
                  <li
                    key={h}
                    className="rounded-xl border border-border bg-surface px-4 py-3 text-sm"
                  >
                    {t(`layer_${open.id.replace("-", "_")}_h${idx + 1}`, h)}
                  </li>
                ))}
              </ul>
              <Button asChild className="w-full">
                <Link to={layerLinks[open.id] ?? "/mentor"}>
                  {layerLinks[open.id] ? t("protocol_open_layer", "Open this layer") : t("protocol_work_with_mentor", "Work on it with your mentor")}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
