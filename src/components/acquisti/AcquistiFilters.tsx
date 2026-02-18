import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";

const ageFilters = ["Tutti", "5-8", "8-10", "10-14", "12-18"];

interface AcquistiFiltersProps {
  ageFilter: string;
  onAgeFilterChange: (filter: string) => void;
}

export function AcquistiFilters({ ageFilter, onAgeFilterChange }: AcquistiFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-8 p-4 rounded-2xl bg-muted/50 border border-border/50">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Filter className="w-4 h-4" />
        <span className="text-sm font-medium">Età:</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {ageFilters.map((filter) => (
          <Button
            key={filter}
            variant={ageFilter === filter ? "default" : "outline"}
            size="sm"
            onClick={() => onAgeFilterChange(filter)}
          >
            {filter === "Tutti" ? filter : `${filter} anni`}
          </Button>
        ))}
      </div>
    </div>
  );
}
