const fs = require("fs");
const path = "d:/alter-ego-os/src/routes/dashboard.tsx";
let c = fs.readFileSync(path, "utf8");

if (!c.includes('import { CardGrid } from "@/features/cards/CardGrid";')) {
  c = c.replace(
    'import { AppShell, PageHeader } from "@/components/app-shell";',
    'import { AppShell, PageHeader } from "@/components/app-shell";\nimport { CardGrid } from "@/features/cards/CardGrid";'
  );
}

const needle = '<section className="mt-5">';
const replacement = `<section className="mt-5 space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="label-eyebrow">{t("dashboard_cards_eyebrow", "Active Modules")}</p>
            <h3 className="mt-1 text-xl">{t("dashboard_cards_title", "Transformation Cards")}</h3>
          </div>
        </div>
        <CardGrid />
      </section>

      <section className="mt-5">`;

if (c.includes(needle) && !c.includes("<CardGrid />")) {
  c = c.replace(needle, replacement);
  fs.writeFileSync(path, c, "utf8");
  console.log("Successfully updated dashboard.tsx with CardGrid");
} else {
  console.log("Already updated or needle not found");
}

