import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useDecisionSupport, useDemandSignals, useMatchSupply } from "@/hooks/queries";
import { CATEGORIES, CITIES, qty } from "@/lib/constants";
import { EmptyState, ErrorState, LoadingState, PageHeading } from "@/components/common/States";

export default function FarmerInsightsPage() {
  const { place } = useOutletContext();
  const { user } = useAuth();
  const coords = user?.farmDetails?.location?.coordinates;
  const [category, setCategory] = useState("");
  const [radiusKm, setRadius] = useState(30);
  const base = useMemo(() => { const c = coords?.length === 2 ? { lat: coords[1], lng: coords[0] } : place || CITIES[0]; return { lat: c.lat, lng: c.lng, radiusKm }; }, [coords, place, radiusKm]);
  const support = useDecisionSupport(base, true);
  const signals = useDemandSignals({ ...base, category });
  const match = useMatchSupply({ ...base, category }, true);
  const TrendIcon = signals.data?.trendSignal === "INCREASING" ? TrendingUp : signals.data?.trendSignal === "DECREASING" ? TrendingDown : Minus;
  return (
    <div className="resource-page">
      <PageHeading eyebrow="Farm workspace" title="Demand insights" />
      <div className="filters-bar"><select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category" data-testid="insights-category-select"><option value="">All categories</option>{CATEGORIES.filter((c) => c.key).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select><select value={radiusKm} onChange={(e) => setRadius(Number(e.target.value))} aria-label="Radius" data-testid="insights-radius-select">{[15, 30, 60, 120].map((r) => <option key={r} value={r}>{r} km</option>)}</select></div>

      <h3 className="section-title">Harvest decision support</h3>
      {support.isLoading && <LoadingState rows={2} />}
      {support.isError && <ErrorState error={support.error} onRetry={support.refetch} />}
      {support.data && support.data.insights?.length === 0 && <EmptyState title="No insights yet" text={support.data.message || "List produce to see how nearby demand compares with your stock."} />}
      {support.data?.insights?.length > 0 && <div className="card-list" data-testid="decision-support-list">{support.data.insights.map((i, idx) => <article key={i.productId || idx} className="data-card insight-card" data-testid={`insight-${idx}`}><div className="data-card-head"><div><h3>{i.productName || i.name}</h3>{i.guidance && <span className="sub">{i.guidance}</span>}</div>{i.demandLevel && <span className={`status-badge ${i.demandLevel === "HIGH_DEMAND" ? "tone-success" : i.demandLevel === "AMPLE_SUPPLY" ? "tone-warning" : "tone-muted"}`}>{i.demandLevel.replace("_", " ")}</span>}</div><div className="meta-grid"><div><span>Listed</span><strong>{qty(i.availableStock, i.unit)}</strong></div><div><span>Requested nearby (7d)</span><strong>{qty(i.nearby7DaysRequestedQty)}</strong></div><div><span>Trend</span><strong>{i.trend}</strong></div></div><p className="muted">{i.explanation}</p></article>)}</div>}
      {support.data?.insights?.[0]?.disclaimer && <p className="disclaimer">{support.data.insights[0].disclaimer}</p>}

      <h3 className="section-title">Market demand signal <TrendIcon size={18} /></h3>
      {signals.isLoading && <LoadingState rows={1} />}
      {signals.isError && <ErrorState error={signals.error} onRetry={signals.refetch} />}
      {signals.data && <div className="data-card" data-testid="demand-signal-card"><div className="meta-grid"><div><span>Trend</span><strong>{signals.data.trendSignal}</strong></div><div><span>Requests (7d)</span><strong>{signals.data.current7DaysRequests}</strong></div><div><span>Requested qty (7d)</span><strong>{qty(signals.data.requestedQuantity7Days)}</strong></div><div><span>Completed qty (7d)</span><strong>{qty(signals.data.completedQuantity7Days)}</strong></div><div><span>Growth</span><strong>{signals.data.growthPercent > 0 ? "+" : ""}{signals.data.growthPercent}%</strong></div></div><p className="disclaimer">{signals.data.disclaimer}</p></div>}

      <h3 className="section-title">Nearby supply for this category</h3>
      {match.isLoading && <LoadingState rows={1} />}
      {match.isError && <ErrorState error={match.error} onRetry={match.refetch} />}
      {match.data && match.data.matches.length === 0 && <p className="muted">No competing supply within {radiusKm} km.</p>}
      {match.data?.matches.length > 0 && <div className="table-wrap"><table className="data-table" data-testid="supply-table"><thead><tr><th>Produce</th><th>Farm</th><th>Available</th><th>Price</th><th>Distance</th></tr></thead><tbody>{match.data.matches.slice(0, 15).map((m) => <tr key={m.productId}><td>{m.name}</td><td>{m.farmer.farmName || m.farmer.name}</td><td>{qty(m.availableStock, m.unit)}</td><td>₹{m.pricePerUnit}</td><td>{m.distanceKm} km</td></tr>)}</tbody></table></div>}
    </div>
  );
}
