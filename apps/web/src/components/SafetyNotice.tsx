import type { SafetyNotice } from "@alter-ego/api-client";
import { HeartHandshake } from "lucide-react";

import { Button } from "@/components/primitives";

/**
 * Shown instead of a coaching reply when the safety boundary triggers.
 * It is supportive and plain: no scores, no streak language, no upsell.
 */
export function SafetyNoticeCard({
  notice,
  onContinue,
}: {
  notice: SafetyNotice;
  onContinue?: () => void;
}) {
  return (
    <section
      role="alert"
      aria-label="Support"
      className="rise-in rounded-xl border border-border-strong bg-accent-soft p-5"
    >
      <div className="flex items-start gap-3">
        <HeartHandshake className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
        <div>
          <p className="text-sm leading-relaxed">{notice.message}</p>
          <ul className="mt-4 space-y-3">
            {notice.resources.map((r) => (
              <li key={r.id} className="rounded-lg border border-border bg-card p-3">
                <p className="text-sm font-semibold">{r.name}</p>
                <p className="mt-0.5 text-sm">{r.contact}</p>
                {r.note ? <p className="mt-0.5 text-xs text-muted-foreground">{r.note}</p> : null}
              </li>
            ))}
          </ul>
          {onContinue ? (
            <Button variant="outline" className="mt-4 h-10 w-auto px-4" onClick={onContinue}>
              Continue
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
