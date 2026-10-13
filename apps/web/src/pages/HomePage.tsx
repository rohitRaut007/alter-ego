import { useQuery } from "@tanstack/react-query";

import { Button, Card, Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export function HomePage() {
  const { api, signOut } = useAuth();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/me");
      if (!data) throw new Error(`Could not load your account (${JSON.stringify(error)})`);
      return data;
    },
  });

  if (me.isPending) return <Spinner label="Loading your account" />;
  if (me.isError) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <Card>
          <p role="alert" className="text-sm text-destructive">
            We could not load your account. Please try again.
          </p>
          <Button className="mt-4" onClick={() => void me.refetch()}>Retry</Button>
        </Card>
      </main>
    );
  }

  const user = me.data;
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">Alter Ego OS</p>
      <h1 className="mt-2 font-display text-3xl">
        {user.display_name ? `Welcome, ${user.display_name}.` : "Welcome."}
      </h1>
      <Card className="mt-8">
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
      <p className="mt-6 text-sm text-muted-foreground">
        The onboarding interview arrives in the next phase.
      </p>
      <Button className="mt-8 w-auto" onClick={() => void signOut()}>Sign out</Button>
    </main>
  );
}
