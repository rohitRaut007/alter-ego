with open("src/components/app-shell.tsx", "r", encoding="utf-8") as f:
    c = f.read()

# Replace all <Link\n or <Link\r\n or <Link 
import re
c = re.sub(r'<Link(\s)', r'<SafeLink\1', c)

with open("src/components/app-shell.tsx", "w", encoding="utf-8", newline="\r\n") as f:
    f.write(c)

print("Updated app-shell.tsx with regex SafeLink")

