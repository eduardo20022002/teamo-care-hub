import type { SearchHit } from "@/services/search.service";
import { SearchResultItem } from "./SearchResultItem";

interface Props {
  hits: SearchHit[];
  onSelect: (hit: SearchHit) => void;
}

export function SearchResultsList({ hits, onSelect }: Props) {
  return (
    <div className="space-y-2">
      {hits.map((hit) => (
        <SearchResultItem key={`${hit.kind}-${hit.id}`} hit={hit} onClick={() => onSelect(hit)} />
      ))}
    </div>
  );
}
