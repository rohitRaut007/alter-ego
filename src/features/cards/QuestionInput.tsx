import * as React from "react";
import { ChoiceChips } from "@/components/ChoiceChips";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CardStepInputType } from "@/lib/api-types";

export interface QuestionInputProps {
  type: CardStepInputType;
  options?: string[] | undefined;
  placeholder?: string | undefined;
  value: string | string[];
  onChange: (val: string | string[]) => void;
  disabled?: boolean | undefined;
}

export function QuestionInput({
  type,
  options = [],
  placeholder = "Type your response...",
  value,
  onChange,
  disabled = false,
}: QuestionInputProps) {
  switch (type) {
    case "text":
      return (
        <textarea
          value={typeof value === "string" ? value : value.join(", ")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          rows={4}
          aria-label={placeholder}
          className={cn(
            "w-full rounded-2xl border border-border bg-card p-4 text-sm outline-none transition-all",
            "placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring focus:ring-offset-1",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        />
      );

    case "chips":
      return (
        <ChoiceChips
          options={options}
          selected={typeof value === "string" ? value : value[0] || ""}
          onChange={(v) => onChange(typeof v === "string" ? v : v[0] || "")}
          variant="single"
          allowCustom={true}
          placeholder={placeholder}
          disabled={disabled}
        />
      );

    case "multi_chips":
      return (
        <ChoiceChips
          options={options}
          selected={Array.isArray(value) ? value : value ? [value] : []}
          onChange={(v) => onChange(Array.isArray(v) ? v : [v])}
          variant="multi"
          allowCustom={true}
          placeholder={placeholder}
          disabled={disabled}
        />
      );

    case "options":
      return (
        <div className="space-y-2.5" role="radiogroup" aria-label="Step options">
          {options.map((opt) => {
            const isSelected = value === opt;
            return (
              <button
                key={opt}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={disabled}
                onClick={() => onChange(opt)}
                className={cn(
                  "w-full text-left rounded-2xl border p-4 transition-all duration-200 cursor-pointer",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-xs"
                    : "border-border bg-card hover:border-foreground/20 hover:bg-muted/40",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{opt}</span>
                  <div
                    className={cn(
                      "size-4 rounded-full border flex items-center justify-center shrink-0 ml-3",
                      isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border",
                    )}
                  >
                    {isSelected && <Check className="size-2.5 stroke-[3]" />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      );

    default:
      return null;
  }
}

export default QuestionInput;

