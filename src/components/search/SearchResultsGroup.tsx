import type { SearchHit, SearchKind } from "@/services/search.service";
import { getSearchKindLabel } from "@/services/search.service";
import { SearchResultItem } from "./SearchResultItem";

interface Props {
  kind: SearchKind;
  hits: SearchHit[];
  onSelect: (hit: SearchHit) => void;
}

export function SearchResultsGroup({ kind, hits, onSelect }: Props) {
  if (hits.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {getSearchKindLabel(kind)}{" "}
        <span className="font-normal text-muted-foreground/80">({hits.length})</span>
      </h2>
      <div className="space-y-2">
        {hits.map((hit) => (
          <SearchResultItem key={hit.id} hit={hit} onClick={() => onSelect(hit)} />
        ))}
      </div>
    </section>
  );
}
