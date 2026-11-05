with open("src/components/app-shell.tsx", "r", encoding="utf-8") as f:
    c = f.read()

target = 'const SafeLink = ({ to, className, children: linkChildren }: { to: string; className?: string; children: ReactNode }) => {\n    if (hasRouter) {\n      return <SafeLink to={to} className={className}>{linkChildren}</SafeLink>;'
replacement = 'const SafeLink = ({ to, className, children: linkChildren }: { to: string; className?: string | undefined; children: ReactNode }) => {\n    if (hasRouter) {\n      return <Link to={to} className={className}>{linkChildren}</Link>;'

if target.replace("\n", "\r\n") in c:
    c = c.replace(target.replace("\n", "\r\n"), replacement.replace("\n", "\r\n"))
elif target in c:
    c = c.replace(target, replacement)
else:
    print("Target not found!")

with open("src/components/app-shell.tsx", "w", encoding="utf-8", newline="\r\n") as f:
    f.write(c)

print("Updated SafeLink in app-shell.tsx")

