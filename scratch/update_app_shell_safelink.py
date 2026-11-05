with open("src/components/app-shell.tsx", "r", encoding="utf-8") as f:
    c = f.read()

# Replace imports
c = c.replace(
    'import { Link, useRouterState } from "@tanstack/react-router";',
    'import { Link, useRouterState, useRouter } from "@tanstack/react-router";'
)

# Add NavLink helper inside AppShell
old_block = '''export function AppShell({ children }: { children: ReactNode }) {
  let pathname = "/";
  try {
    pathname = useRouterState({ select: (s) => s.location.pathname });
  } catch {
    if (typeof window !== "undefined" && window.location) {
      pathname = window.location.pathname;
    }
  }'''

new_block = '''export function AppShell({ children }: { children: ReactNode }) {
  let pathname = "/";
  let hasRouter = false;
  try {
    const router = useRouter();
    hasRouter = Boolean(router);
    pathname = useRouterState({ select: (s) => s.location.pathname });
  } catch {
    hasRouter = false;
    if (typeof window !== "undefined" && window.location) {
      pathname = window.location.pathname;
    }
  }

  const SafeLink = ({ to, className, children: linkChildren }: { to: string; className?: string; children: ReactNode }) => {
    if (hasRouter) {
      return <Link to={to} className={className}>{linkChildren}</Link>;
    }
    return <a href={to} className={className}>{linkChildren}</a>;
  };'''

if old_block.replace("\n", "\r\n") in c:
    c = c.replace(old_block.replace("\n", "\r\n"), new_block.replace("\n", "\r\n"))
elif old_block in c:
    c = c.replace(old_block, new_block)
else:
    print("Old block not found!")

# Replace all <Link with <SafeLink and </Link> with </SafeLink> inside AppShell
c = c.replace("<Link ", "<SafeLink ")
c = c.replace("</Link>", "</SafeLink>")

with open("src/components/app-shell.tsx", "w", encoding="utf-8", newline="\r\n") as f:
    f.write(c)

print("Updated app-shell.tsx with SafeLink")

