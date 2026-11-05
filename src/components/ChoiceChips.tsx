import * as React from "react";
import { Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface ChoiceChipsProps {
  /** Array of option strings to display */
  options?: string[];
  /** Legacy alias for options */
  suggestions?: string[];
  /** Current selected value: string for single-select, string[] for multi-select */
  selected: string | string[];
  /** Callback when selection changes */
  onChange?: (val: string | string[]) => void;
  /** Legacy toggle callback */
  onToggle?: (val: string) => void;
  /** Legacy custom input callback */
  onCustom?: (val: string) => void;
  /** Selection variant: single-select or multi-select */
  variant?: "single" | "multi";
  /** Whether to show custom option text input */
  allowCustom?: boolean;
  /** Custom input placeholder */
  placeholder?: string;
  /** Text for custom add button */
  addLabel?: string;
  /** Label for selected summary */
  selectedLabel?: string;
  /** Disabled state */
  disabled?: boolean;
  className?: string;
}

export function ChoiceChips({
  options,
  suggestions,
  selected,
  onChange,
  onToggle,
  onCustom,
  variant = "multi",
  allowCustom = true,
  placeholder = "Add your own...",
  addLabel = "Add",
  selectedLabel = "Selected:",
  disabled = false,
  className,
}: ChoiceChipsProps) {
  const [customValue, setCustomValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const chipOptions = React.useMemo(() => {
    return Array.from(new Set([...(options ?? suggestions ?? [])]));
  }, [options, suggestions]);

  const selectedArray = React.useMemo(() => {
    if (Array.isArray(selected)) return selected;
    return selected ? [selected] : [];
  }, [selected]);

  const handleChipClick = (val: string) => {
    if (disabled) return;

    if (variant === "single") {
      const next = selectedArray.includes(val) ? "" : val;
      onChange?.(next);
      onToggle?.(val);
    } else {
      const isSelected = selectedArray.includes(val);
      const next = isSelected
        ? selectedArray.filter((item) => item !== val)
        : [...selectedArray, val];
      onChange?.(next);
      onToggle?.(val);
    }
  };

  const handleAddCustom = () => {
    const trimmed = customValue.trim();
    if (!trimmed || disabled) return;

    if (onCustom) {
      onCustom(trimmed);
    } else if (onChange) {
      if (variant === "single") {
        onChange(trimmed);
      } else {
        if (!selectedArray.includes(trimmed)) {
          onChange([...selectedArray, trimmed]);
        }
      }
    }
    setCustomValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddCustom();
    }
  };

  return (
    <div className={cn("space-y-3", className)} role="group" aria-label="Choice selection">
      <div className="flex flex-wrap gap-2">
        {chipOptions.map((opt) => {
          const isSelected = selectedArray.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              role="button"
              aria-pressed={isSelected}
              disabled={disabled}
              onClick={() => handleChipClick(opt)}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  handleChipClick(opt);
                }
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-200 cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:pointer-events-none disabled:opacity-50",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
              )}
            >
              {isSelected && <Check className="size-3.5 stroke-[2.5]" aria-hidden="true" />}
              <span>{opt}</span>
            </button>
          );
        })}
      </div>

      {/* Selected summary bar for multi-select */}
      {variant === "multi" && selectedArray.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs"
          aria-live="polite"
        >
          <span className="font-medium text-muted-foreground mr-1">{selectedLabel}</span>
          {selectedArray.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
            >
              {item}
              <button
                type="button"
                aria-label={`Remove ${item}`}
                disabled={disabled}
                onClick={() => handleChipClick(item)}
                className="hover:text-primary/70 focus-visible:outline-none cursor-pointer rounded-full p-0.5"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add your own input */}
      {allowCustom && (
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            aria-label={placeholder}
            className={cn(
              "flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none transition-all",
              "placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring focus:ring-offset-1",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || !customValue.trim()}
            onClick={handleAddCustom}
            className="gap-1 font-medium"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            {addLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

export default ChoiceChips;

