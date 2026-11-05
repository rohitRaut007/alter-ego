with open("src/components/app-shell.tsx", "r", encoding="utf-8") as f:
    c = f.read()

target = "export function AppShell({ children }: { children: ReactNode }) {\n  const pathname = useRouterState({ select: (s) => s.location.pathname });"
replacement = """export function AppShell({ children }: { children: ReactNode }) {
  let pathname = "/";
  try {
    pathname = useRouterState({ select: (s) => s.location.pathname });
  } catch {
    if (typeof window !== "undefined" && window.location) {
      pathname = window.location.pathname;
    }
  }"""

if target.replace("\n", "\r\n") in c:
    c = c.replace(target.replace("\n", "\r\n"), replacement.replace("\n", "\r\n"))
elif target in c:
    c = c.replace(target, replacement)
else:
    print("Target not found!")

with open("src/components/app-shell.tsx", "w", encoding="utf-8", newline="\r\n") as f:
    f.write(c)

print("Updated app-shell.tsx successfully")

