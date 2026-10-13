import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import { AppShell } from "@/components/AppShell";
import { Button, Card, Eyebrow, Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export function HomePage() {
  const { api } = useAuth();

  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await api.GET("/api/v1/me");
      if (!data) throw new Error("Could not load your account.");
      return data;
    },
  });

  const protocol = useQuery({
    queryKey: ["protocol", "latest"],
    queryFn: async () => {
      const { data, response } = await api.GET("/api/v1/protocols/latest");
      if (response.status === 404) return null;
      if (!data) throw new Error("Could not load your protocol.");
      return data;
    },
  });

  if (me.isPending || protocol.isPending) {
    return (
      <AppShell>
        <Spinner label="Loading" />
      </AppShell>
    );
  }
  if (me.isError || protocol.isError) {
    return (
      <AppShell>
        <Card>
          <p role="alert" className="text-sm text-destructive">
            We could not load your account. Please try again.
          </p>
          <Button
            className="mt-4 w-auto"
            onClick={() => {
              void me.refetch();
              void protocol.refetch();
            }}
          >
            Retry
          </Button>
        </Card>
      </AppShell>
    );
  }

  const user = me.data;
  const p = protocol.data;
  const generating = p?.status === "generating";

  return (
    <AppShell>
      <Eyebrow>Alter Ego OS</Eyebrow>
      <h1 className="mt-2 font-display text-3xl">
        {user.display_name ? `Welcome, ${user.display_name}.` : "Welcome."}
      </h1>

      <Card className="mt-8">
        {p === null ? (
          <>
            <h2 className="text-lg font-semibold">Begin the interview</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              A conversation about your ambition, position, working style and the patterns you want
              to design around. Your protocol is built from your own answers. Set aside 15 to 25
              minutes.
            </p>
            <Link to="/onboarding" className="mt-5 inline-block">
              <Button className="w-auto">
                Start the interview <ArrowRight className="size-4" />
              </Button>
            </Link>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold">
              {generating ? "Your protocol is being built" : "Your protocol"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {generating
                ? "Sections appear as they are written."
                : "Review it, revise any section, or download a PDF."}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {!generating ? (
                <Link to="/today">
                  <Button className="w-auto">
                    Open today <ArrowRight className="size-4" />
                  </Button>
                </Link>
              ) : null}
              <Link to={`/protocol/${p.id}`}>
                <Button variant={generating ? "primary" : "outline"} className="w-auto">
                  Open protocol
                </Button>
              </Link>
            </div>
          </>
        )}
      </Card>

      <Card className="mt-6">
        <h2 className="text-sm font-semibold">Your plan</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tier: <span className="font-medium text-foreground">{user.tier}</span>
        </p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {user.entitlements.map((f) => (
            <li key={f} className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium">
              {f.replace("_", " ")}
            </li>
          ))}
        </ul>
      </Card>
    </AppShell>
  );
}
