import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { List, Map, MapPin, Search, SlidersHorizontal } from "lucide-react";
import { CATEGORIES, CITIES } from "@/lib/constants";
import { useMarketplace } from "@/hooks/queries";
import { ProductCard } from "@/components/marketplace/ProductCard";
import { MarketMap } from "@/components/marketplace/MarketMap";
import { EmptyState, ErrorState, Pagination } from "@/components/common/States";

const useDebounced = (value, ms = 350) => { const [v, setV] = useState(value); useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]); return v; };

export default function MarketplacePage() {
  const { place, openLocation } = useOutletContext();
  const center = place || CITIES[0];
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sortBy, setSortBy] = useState("recommended");
  const [filters, setFilters] = useState({ radius: 150, minPrice: "", maxPrice: "", freshnessTier: "", onlyVerified: false });
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState("list");
  const [page, setPage] = useState(1);
  const debounced = useDebounced(search);
  const params = useMemo(() => ({ lat: center.lat, lng: center.lng, radius: filters.radius, search: debounced, category, sortBy, minPrice: filters.minPrice, maxPrice: filters.maxPrice, freshnessTier: filters.freshnessTier, onlyVerified: filters.onlyVerified ? "true" : "", page, limit: 24 }), [center, filters, debounced, category, sortBy, page]);
  useEffect(() => { setPage(1); }, [debounced, category, sortBy, filters, center]);
  const q = useMarketplace(params);
  const items = q.data?.items || [];

  return (
    <div className="marketplace-page">
      <section className="market-hero">
        <div className="hero-copy"><span className="eyebrow light">Farm to your doorstep</span><h1>Fresh harvests.<br /><span>Real farmers.</span></h1><p>Discover honest, seasonal produce grown close to home.</p>
          <div className="hero-location"><MapPin size={17} /><span>{center.name}</span><button onClick={openLocation} data-testid="hero-location-button">Change</button></div></div>
        <div className="hero-image"><img src="https://images.unsplash.com/photo-1775677073681-194049b1a7d3?auto=format&fit=crop&w=1100&q=85" alt="Fresh farm vegetables" /></div>
      </section>
      <section className="market-controls">
        <div className="search-field"><Search size={19} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vegetables, fruits, grains..." aria-label="Search produce" data-testid="marketplace-search-input" /><button className="filter-button" onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters} data-testid="marketplace-filter-button"><SlidersHorizontal size={17} /> Filters</button></div>
        {showFilters && (
          <div className="filter-panel" data-testid="marketplace-filter-panel">
            <label>Radius (km)<select value={filters.radius} onChange={(e) => setFilters({ ...filters, radius: Number(e.target.value) })} data-testid="filter-radius-select">{[10, 25, 50, 100, 150, 300].map((r) => <option key={r} value={r}>{r} km</option>)}</select></label>
            <label>Min price ₹<input type="number" min="0" value={filters.minPrice} onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })} data-testid="filter-min-price-input" /></label>
            <label>Max price ₹<input type="number" min="0" value={filters.maxPrice} onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })} data-testid="filter-max-price-input" /></label>
            <label>Freshness<select value={filters.freshnessTier} onChange={(e) => setFilters({ ...filters, freshnessTier: e.target.value })} data-testid="filter-freshness-select"><option value="">Any</option><option value="FRESH_HARVEST">Fresh harvest</option><option value="NORMAL">Normal</option><option value="SELL_SOON">Sell soon (deals)</option></select></label>
            <label className="checkbox-row"><input type="checkbox" checked={filters.onlyVerified} onChange={(e) => setFilters({ ...filters, onlyVerified: e.target.checked })} data-testid="filter-verified-checkbox" /> Verified farmers only</label>
          </div>
        )}
        <div className="category-row" data-testid="category-filter-row">{CATEGORIES.map((c) => <button key={c.key} className={category === c.key ? "category-chip active" : "category-chip"} onClick={() => setCategory(c.key)} aria-pressed={category === c.key} data-testid={`category-${c.key || "all"}-button`}><span>{c.icon}</span>{c.label}</button>)}</div>
        <div className="results-bar">
          <span data-testid="marketplace-result-count"><strong>{q.data?.pagination?.total ?? "—"}</strong> harvests within {filters.radius} km of {center.name}</span>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort" data-testid="marketplace-sort-select"><option value="recommended">Recommended</option><option value="freshness">Freshest first</option><option value="distance">Nearest first</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="urgency">Sell-soon deals</option></select>
          <button className="map-toggle" onClick={() => setView(view === "list" ? "map" : "list")} data-testid="map-view-button">{view === "list" ? <><Map size={16} /> Map view</> : <><List size={16} /> List view</>}</button>
        </div>
      </section>
      {q.isLoading && <div className="product-grid" data-testid="marketplace-loading">{[1, 2, 3, 4].map((i) => <div className="skeleton product-skeleton" key={i} />)}</div>}
      {q.isError && <ErrorState error={q.error} onRetry={q.refetch} />}
      {q.data && view === "map" && <MarketMap items={items} center={center} radiusKm={filters.radius} />}
      {q.data && view === "list" && items.length > 0 && <div className="product-grid" data-testid="marketplace-product-grid">{items.map((item) => <ProductCard key={item._id} product={item} />)}</div>}
      {q.data && items.length === 0 && (
        <div className="empty-market-wrap">
          <EmptyState
            title="No harvests match right now"
            text="Try widening the radius to 300 km (All Tamil Nadu) or switch to a major agricultural trading district."
            action="Widen radius to 300 km (All Tamil Nadu)"
            onAction={() => setFilters({ ...filters, radius: 300 })}
          />
          <div className="active-cities-quickswitch" style={{ textAlign: "center", marginTop: "14px", paddingBottom: "24px" }}>
            <span style={{ fontSize: "13px", color: "var(--muted)", marginRight: "8px", display: "inline-block", marginBottom: "8px" }}>
              Explore harvests in:
            </span>
            {CITIES.map((c) => (
              <button
                key={c.name}
                type="button"
                className={`ghost-button compact ${center.name === c.name ? "active" : ""}`}
                style={{ margin: "2px 4px", fontSize: "12px" }}
                onClick={() => {
                  const next = { name: c.name, lat: c.lat, lng: c.lng };
                  localStorage.setItem("uzhavan_location_v2", JSON.stringify(next));
                  window.dispatchEvent(new CustomEvent("uzhavan:locationChange", { detail: next }));
                }}
              >
                📍 {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {q.data && <Pagination pagination={q.data.pagination} page={page} onChange={setPage} />}
    </div>
  );
}
