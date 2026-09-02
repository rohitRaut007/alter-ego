import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  Compass,
  Fingerprint,
  Flag,
  MessageSquare,
  Sparkles,
  Sun,
  Target,
  UserCog,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { layers } from "@/lib/mock-data";
import { Hero } from "@/components/hero/hero";
import { useLanguage } from "@/lib/i18n";
import { LanguageSelector } from "@/components/ui/language-selector";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Alter Ego OS — Become the person you were meant to become" },
      {
        name: "description",
        content:
          "An AI-powered personal operating system that turns your ambition into a seven-layer protocol, a daily practice and a mentor that holds you to it.",
      },
      { property: "og:title", content: "Alter Ego OS — Your personal transformation protocol" },
      {
        property: "og:description",
        content:
          "Design your alter ego, build the character stack behind it, and run the daily system with an AI mentor.",
      },
    ],
  }),
  component: Landing,
});

const layerIcons = [Fingerprint, UserCog, BookOpen, Target, Sun, Sparkles, Flag];

const steps = [
  {
    n: "01",
    titleKey: "interview_step_01_title",
    bodyKey: "interview_step_01_body",
  },
  {
    n: "02",
    titleKey: "interview_step_02_title",
    bodyKey: "interview_step_02_body",
  },
  {
    n: "03",
    titleKey: "interview_step_03_title",
    bodyKey: "interview_step_03_body",
  },
];

function Landing() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight">Alter Ego OS</span>
          </div>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#system" className="transition-colors hover:text-foreground">
              {t("nav_the_system", "The system")}
            </a>
            <a href="#mentor" className="transition-colors hover:text-foreground">
              {t("nav_mentor", "AI mentor")}
            </a>
            <a href="#how" className="transition-colors hover:text-foreground">
              {t("nav_how_it_works", "How it works")}
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
              <Link to="/dashboard">{t("nav_sign_in", "Sign in")}</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/onboarding">{t("nav_build_alter_ego", "Build My Alter Ego")}</Link>
            </Button>
          </div>
        </div>
      </header>

      <Hero />

      <section id="system" className="border-t border-border bg-surface py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="max-w-2xl">
            <p className="label-eyebrow">{t("seven_layers", "The seven layers")}</p>
            <h2 className="text-display mt-3 text-3xl sm:text-4xl">
              {t("seven_layers_title", "A person is a system. Most people never design theirs.")}
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {t(
                "seven_layers_subtitle",
                "Each layer inherits from the one above it. Change your identity architecture and the daily practices follow — not the other way around.",
              )}
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {layers.map((layer, i) => {
              const Icon = layerIcons[i] ?? Sparkles;
              return (
                <div
                  key={layer.id}
                  className="group rounded-2xl border border-border bg-card p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                      <Icon className="size-[18px]" />
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">0{layer.index}</span>
                  </div>
                  <h3 className="mt-5 text-xl">{layer.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {layer.tagline}
                  </p>
                </div>
              );
            })}
            <div className="flex flex-col justify-between rounded-2xl border border-border bg-primary p-6 text-primary-foreground shadow-soft">
              <p className="font-display text-2xl leading-tight">
                {t("landing_seven_layers_card_title", "Seven layers, one coherent person.")}
              </p>
              <Button variant="secondary" asChild className="mt-6 w-fit">
                <Link to="/onboarding">
                  {t("home_start_interview", "Start the interview")} <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section id="mentor" className="py-20 sm:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2">
          <div>
            <p className="label-eyebrow">{t("mentor_section_eyebrow", "AI mentor")}</p>
            <h2 className="text-display mt-3 text-3xl sm:text-4xl">
              {t("mentor_section_title", "Coaching that already knows your protocol.")}
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {t(
                "mentor_section_desc",
                "Your mentor sees every layer, every streak and every missed block. It doesn't motivate you — it tells you precisely which constraint is binding and what to do in the next ninety minutes.",
              )}
            </p>
            <ul className="mt-8 space-y-4">
              {[
                [
                  t("mentor_bullet_1_title", "Context-aware"),
                  t("mentor_bullet_1_desc", "Answers reference your sprint, traits and streaks."),
                ],
                [
                  t("mentor_bullet_2_title", "Accountability"),
                  t("mentor_bullet_2_desc", "Weekly challenges calibrated to your weakest layer."),
                ],
                [
                  t("mentor_bullet_3_title", "Recalibration"),
                  t("mentor_bullet_3_desc", "Your protocol is rewritten as you change, not annually."),
                ],
              ].map(([tVal, dVal]) => (
                <li key={tVal} className="flex gap-3">
                  <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <Compass className="size-3" />
                  </span>
                  <span className="text-sm">
                    <span className="font-semibold">{tVal}.</span>{" "}
                    <span className="text-muted-foreground">{dVal}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-border bg-card p-6 shadow-lift sm:p-8">
            <div className="flex items-center gap-2 border-b border-border pb-4">
              <MessageSquare className="size-4 text-accent" />
              <span className="text-sm font-semibold">{t("mentor_chat_label", "Mentor")}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {t("mentor_chat_day", "Day")} 34 {t("mentor_chat_of", "of")} 90
              </span>
            </div>
            <div className="mt-5 space-y-4">
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-secondary px-4 py-3 text-sm">
                {t("mentor_message_1", "I keep pushing the launch essay. Third week now.")}
              </div>
              <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-border bg-surface px-4 py-3 text-sm leading-relaxed">
                {t(
                  "mentor_message_2",
                  "It isn't a writing problem. Your Sovereignty trait sits at 46 — you open inputs before you produce output, so the essay never gets your sharpest hours. Move it to the 9am block tomorrow and cap it at 90 minutes.",
                )}
              </div>
            </div>
            <Button variant="outline" className="mt-6 w-full" asChild>
              <Link to="/mentor">{t("home_talk_mentor", "Talk to the mentor")}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section id="how" className="border-y border-border bg-surface py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <p className="label-eyebrow">{t("how_it_works_eyebrow", "How it works")}</p>
          <h2 className="text-display mt-3 max-w-xl text-3xl sm:text-4xl">
            {t("how_it_works_title", "From an honest conversation to a running system.")}
          </h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="bg-card p-8">
                <span className="font-mono text-xs text-accent">{s.n}</span>
                <h3 className="mt-4 text-xl">{t(s.titleKey, s.titleKey)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(s.bodyKey, s.bodyKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
          <h2 className="text-display text-4xl sm:text-5xl">
            {t("landing_cta_section_title", "The version of you that you keep postponing already has a protocol.")}
          </h2>
          <Button size="lg" asChild className="mt-9">
            <Link to="/onboarding">
              {t("nav_build_alter_ego", "Build My Alter Ego")} <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 text-xs text-muted-foreground sm:flex-row sm:px-8">
          <span>{t("footer_copyright", "© 2026 Alter Ego OS")}</span>
          <span>{t("footer_tagline", "Built for people engineering themselves.")}</span>
        </div>
      </footer>
    </div>
  );
}
