import { useMemo, useState } from "react";
import { Briefcase, Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useSandboxIndustry } from "@/contexts/SandboxIndustryContext";

export function IndustryCombobox() {
  const { industries, industryId, industry, setIndustryId } = useSandboxIndustry();
  const [open, setOpen] = useState(false);
  const sorted = useMemo(
    () => [...industries].sort((a, b) => a.name.localeCompare(b.name)),
    [industries],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-label="Search and select industry"
          aria-expanded={open}
          className="flex items-center gap-2 h-9 w-[180px] xs:w-[220px] sm:w-[280px] md:w-[300px] max-w-[60vw] px-3 rounded-full bg-secondary/50 border border-[#f5c542]/40 text-xs sm:text-sm font-bold text-[#f5c542] hover:bg-secondary/70 focus:outline-none focus:ring-1 focus:ring-[#f5c542]/40 transition-colors"
        >
          <Briefcase size={14} className="shrink-0" aria-hidden="true" />
          <span className="truncate flex-1 text-left">{industry.name}</span>
          <ChevronsUpDown size={14} className="shrink-0 opacity-70" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[260px] bg-background border-[#f5c542]/30"
      >
        <Command className="bg-background">
          <CommandInput
            placeholder="Type to search industries…"
            className="text-sm"
            aria-label="Search industries"
          />
          <CommandList className="max-h-[50vh]">
            <CommandEmpty>No industries match.</CommandEmpty>
            <CommandGroup>
              {sorted.map((ind) => (
                <CommandItem
                  key={ind.id}
                  value={`${ind.name} ${ind.id}`}
                  onSelect={() => {
                    setIndustryId(ind.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "text-sm cursor-pointer text-[#f5c542] aria-selected:bg-[#f5c542]/10 aria-selected:text-[#fff3a3]",
                    industryId === ind.id && "text-[#fff3a3] font-semibold",
                  )}
                >
                  <Check
                    size={14}
                    className={cn(
                      "mr-2 shrink-0",
                      industryId === ind.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{ind.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
