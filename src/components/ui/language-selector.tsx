import { Globe, Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SUPPORTED_LANGUAGES, useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LanguageSelector({ className }: { className?: string }) {
  const { language, setLanguage, currentLanguageSpec } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "group inline-flex items-center gap-2 rounded-lg border border-border bg-card/80 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur-md transition-all hover:bg-accent/10 focus:outline-none focus:ring-1 focus:ring-accent",
          className,
        )}
      >
        <Globe className="size-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
        <span className="flex items-center gap-1.5">
          <span>{currentLanguageSpec.flag}</span>
          <span className="hidden sm:inline-block">{currentLanguageSpec.name}</span>
          <span className="sm:hidden">{currentLanguageSpec.code.slice(0, 2).toUpperCase()}</span>
        </span>
        <ChevronDown className="size-3 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 p-1.5 backdrop-blur-xl">
        <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Language / 语言 / Idioma / 언어
        </div>
        {SUPPORTED_LANGUAGES.map((lang) => {
          const isSelected = lang.code === language;
          return (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className={cn(
                "flex cursor-pointer items-center justify-between rounded-md px-2.5 py-2 text-xs transition-colors",
                isSelected
                  ? "bg-accent/15 font-semibold text-accent"
                  : "hover:bg-accent/10 hover:text-foreground",
              )}
            >
              <span className="flex items-center gap-2">
                <span className="text-sm">{lang.flag}</span>
                <span>{lang.nativeName}</span>
              </span>
              {isSelected && <Check className="size-3.5 text-accent" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
