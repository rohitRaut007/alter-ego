import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Suspense, lazy, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";

const HeroScene = lazy(() => import("./hero-scene"));

const rise = {
  hidden: { opacity: 0, y: 18 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 90, damping: 18, delay: 0.1 + i * 0.09 },
  }),
};

export function Hero() {
  const [mounted, setMounted] = useState(false);
  const [engagement, setEngagement] = useState(0);
  const reduced = useReducedMotion();
  const { t } = useLanguage();

  useEffect(() => setMounted(true), []);

  return (
    <section className="relative overflow-hidden">
      <div className="hairline-grid pointer-events-none absolute inset-0 opacity-50" />
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 -z-0 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-accent-soft blur-[120px] transition-opacity duration-700 lg:left-[70%]"
        style={{ opacity: 0.35 + engagement * 0.35 }}
      />

      <div className="relative mx-auto -mt-10 grid max-w-6xl items-center gap-8 px-5 pb-12 pt-1 sm:px-8 sm:pt-2 lg:-mt-16 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-4">
        <div className="relative z-10 text-center lg:text-left">
          <motion.span
            custom={0}
            initial="hidden"
            animate="show"
            variants={rise}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-soft backdrop-blur"
          >
            <span className="size-1.5 animate-pulse rounded-full bg-accent" />
            {t("hero_badge", "Personal transformation, engineered")}
          </motion.span>

          <motion.h1
            custom={1}
            initial="hidden"
            animate="show"
            variants={rise}
            className="text-display mt-6 text-[2.7rem] leading-[1.02] sm:text-6xl lg:text-[4.1rem]"
          >
            {t("hero_title", "Become the person you were meant to become.")}
          </motion.h1>

          <motion.p
            custom={2}
            initial="hidden"
            animate="show"
            variants={rise}
            className="mx-auto mt-5 max-w-md text-base leading-relaxed text-muted-foreground lg:mx-0"
          >
            {t(
              "hero_subtitle",
              "An AI-powered personal operating system that turns your ambition into a seven-layer protocol, a daily practice and a mentor that holds you to it.",
            )}
          </motion.p>

          <motion.div
            custom={3}
            initial="hidden"
            animate="show"
            variants={rise}
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start"
          >
            <Button size="lg" asChild className="w-full sm:w-auto">
              <Link to="/onboarding">
                {t("hero_cta", "Build My Alter Ego")}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
              <Link to="/dashboard">{t("hero_secondary_cta", "Explore the system")}</Link>
            </Button>
          </motion.div>

          <motion.p
            custom={4}
            initial="hidden"
            animate="show"
            variants={rise}
            className="mt-4 text-xs text-muted-foreground"
          >
            {t("hero_footnote", "10-minute interview · Protocol generated instantly")}
          </motion.p>
        </div>

        {/* interactive 3D universe */}
        <div className="relative z-0 -mx-5 h-[380px] sm:-mx-8 sm:h-[480px] lg:mx-0 lg:h-[620px]">
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: reduced ? 0 : 1.4, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0"
          >
            {mounted && (
              <Suspense fallback={null}>
                <HeroScene onEngagement={setEngagement} />
              </Suspense>
            )}
          </motion.div>

          <motion.div
            className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-border/70 bg-card/70 px-3.5 py-1.5 text-[11px] text-muted-foreground shadow-soft backdrop-blur-md"
          >
            {t("hero_cursor_hint", "Move your cursor into the protocol")}
          </motion.div>

          <motion.div
            className="pointer-events-none absolute right-2 top-24 hidden rounded-xl border border-border/70 bg-card/75 px-3.5 py-2.5 text-left shadow-lift backdrop-blur-md lg:block"
            animate={{
              opacity: engagement > 0.25 ? 1 : 0,
              y: engagement > 0.25 ? 0 : 10,
            }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          >
            <p className="label-eyebrow text-[9px]">{t("hero_core_coherence", "Core coherence")}</p>
            <p className="font-display text-2xl leading-none">
              {Math.round(58 + engagement * 39)}
              <span className="text-sm text-muted-foreground">%</span>
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">{t("hero_layers_responding", "Layers responding to input")}</p>
          </motion.div>
        </div>
      </div>

      <div className="relative mx-auto max-w-6xl px-5 pb-14 sm:px-8">
        <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
          {[
            [t("hero_feature_1_title", "7 layers"), t("hero_feature_1_desc", "From identity down to daily practice")],
            [t("hero_feature_2_title", "90-day sprints"), t("hero_feature_2_desc", "Long horizons, short feedback loops")],
            [t("hero_feature_3_title", "Always-on mentor"), t("hero_feature_3_desc", "Context-aware, never generic")],
          ].map(([k, v], i) => (
            <motion.div
              key={k}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, type: "spring", stiffness: 90, damping: 18 }}
              className="bg-card px-6 py-5"
            >
              <p className="font-display text-xl">{k}</p>
              <p className="mt-1 text-xs text-muted-foreground">{v}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
