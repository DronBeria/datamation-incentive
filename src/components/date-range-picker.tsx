"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

interface DateRangePickerProps {
  value: { from: string; to: string };
  onChange: (range: { from: string; to: string }) => void;
  className?: string;
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);

  const selected: DateRange | undefined =
    value.from || value.to
      ? {
          from: value.from ? new Date(value.from + "T00:00:00") : undefined,
          to: value.to ? new Date(value.to + "T00:00:00") : undefined,
        }
      : undefined;

  const handleSelect = (range: DateRange | undefined) => {
    onChange({
      from: range?.from ? format(range.from, "yyyy-MM-dd") : "",
      to: range?.to ? format(range.to, "yyyy-MM-dd") : "",
    });
    if (range?.from && range?.to) {
      setOpen(false);
    }
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({ from: "", to: "" });
  };

  const hasValue = value.from || value.to;

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-9 justify-start text-left font-normal text-sm min-w-[220px]",
              !hasValue && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-3.5 w-3.5 text-slate-400" />
            {hasValue ? (
              <span>
                {value.from ? format(new Date(value.from + "T00:00:00"), "dd MMM yyyy") : "Start"}{" "}
                &ndash;{" "}
                {value.to ? format(new Date(value.to + "T00:00:00"), "dd MMM yyyy") : "End"}
              </span>
            ) : (
              <span>Pick date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-2 border-b border-slate-100">
            <div className="flex gap-1.5 flex-wrap">
              {[
                { label: "This Month", fn: () => { const n = new Date(); return { from: format(new Date(n.getFullYear(), n.getMonth(), 1), "yyyy-MM-dd"), to: format(n, "yyyy-MM-dd") }; } },
                { label: "Last Month", fn: () => { const n = new Date(); const s = new Date(n.getFullYear(), n.getMonth() - 1, 1); const e = new Date(n.getFullYear(), n.getMonth(), 0); return { from: format(s, "yyyy-MM-dd"), to: format(e, "yyyy-MM-dd") }; } },
                { label: "Last 90 Days", fn: () => { const n = new Date(); const s = new Date(n); s.setDate(s.getDate() - 90); return { from: format(s, "yyyy-MM-dd"), to: format(n, "yyyy-MM-dd") }; } },
                { label: "This Year", fn: () => { const n = new Date(); return { from: format(new Date(n.getFullYear(), 0, 1), "yyyy-MM-dd"), to: format(n, "yyyy-MM-dd") }; } },
              ].map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    onChange(preset.fn());
                    setOpen(false);
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
          <Calendar
            mode="range"
            selected={selected}
            onSelect={handleSelect}
            numberOfMonths={2}
            defaultMonth={value.from ? new Date(value.from + "T00:00:00") : new Date()}
          />
        </PopoverContent>
      </Popover>
      {hasValue && (
        <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={clear}>
          <X className="h-3.5 w-3.5 text-slate-400" />
        </Button>
      )}
    </div>
  );
}
