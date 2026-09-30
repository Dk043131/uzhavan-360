import { Link } from "react-router-dom";
import { ChevronRight, Clock3, LayoutDashboard, Plus, Sprout } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useMyProducts, useOrders, useRequests } from "@/hooks/queries";
import { ACTIVE_ORDER_STATES, qty } from "@/lib/constants";
import { ErrorState } from "@/components/common/States";

export default function FarmerHomePage() {
  const { user } = useAuth();
  const products = useMyProducts();
  const requests = useRequests({ status: "REQUESTED", limit: 1 });
  const orders = useOrders({ limit: 50 });
  const active = orders.data?.items.filter((o) => ACTIVE_ORDER_STATES.includes(o.status)) || [];
  const lowStock = products.data?.filter((p) => p.availableStock > 0 && p.availableStock < 10) || [];
  const sellSoon = products.data?.filter((p) => p.freshnessTier === "SELL_SOON") || [];
  const kpis = [
    ["Pending requests", requests.data?.pagination?.total, "/farmer/requests", "kpi-pending-requests"],
    ["Active orders", orders.data ? active.length : undefined, "/farmer/orders", "kpi-active-orders"],
    ["Low stock", products.data ? lowStock.length : undefined, "/farmer/products", "kpi-low-stock"],
    ["Sell soon", products.data ? sellSoon.length : undefined, "/farmer/insights", "kpi-sell-soon"],
  ];
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return (
    <div className="farmer-page">
      <section className="farmer-hero"><div><span className="eyebrow light">Farm workspace</span><h1>Grow with confidence.</h1><p>Keep your harvest moving from field to family.</p></div><img src="https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?auto=format&fit=crop&w=1000&q=85" alt="Farmer in a green field" /></section>
      <div className="page-heading"><div><span className="eyebrow">Today on your farm</span><h2 data-testid="farmer-greeting">{greet}, {user?.name?.split(" ")[0]}</h2></div><Link to="/farmer/products?new=1" className="primary-button compact" data-testid="farmer-add-produce-link"><Plus size={16} /> Add produce</Link></div>
      {products.isError && <ErrorState error={products.error} onRetry={products.refetch} />}
      <div className="kpi-grid">{kpis.map(([label, value, href, tid]) => <Link to={href} className="kpi-card" key={label} data-testid={tid}><span>◎</span><strong>{value ?? "…"}</strong><small>{label}</small><ChevronRight size={16} /></Link>)}</div>
      {products.data && products.data.length > 0 && (
        <section><h3 className="section-title">Stock at a glance</h3><div className="card-list">{products.data.slice(0, 4).map((p) => <Link key={p._id} to={`/farmer/products/${p._id}`} className="data-card" data-testid={`home-product-${p._id}`}><div className="data-card-head"><div><h3>{p.name}</h3><span className="sub">{qty(p.availableStock, p.unit)} available · {qty(p.reservedStock, p.unit)} reserved · {qty(p.soldStock, p.unit)} sold</span></div><ChevronRight size={16} /></div><StockBar p={p} /></Link>)}</div></section>
      )}
      <div className="quick-actions"><h3>Quick actions</h3><div className="action-grid"><Link to="/farmer/products?new=1" data-testid="quick-add-produce-link"><Plus />Add produce</Link><Link to="/farmer/requests" data-testid="quick-view-requests-link"><Clock3 />View requests</Link><Link to="/farmer/orders" data-testid="quick-view-orders-link"><LayoutDashboard />Manage orders</Link><Link to="/farmer/insights" data-testid="quick-view-insights-link"><Sprout />Demand insights</Link></div></div>
    </div>
  );
}

export function StockBar({ p }) {
  const total = p.totalStock || 1;
  const w = (v) => `${Math.max(0, Math.min(100, (v / total) * 100))}%`;
  return (
    <div>
      <div className="stock-bar" aria-hidden="true"><i className="avail" style={{ width: w(p.availableStock) }} /><i className="resv" style={{ width: w(p.reservedStock) }} /><i className="sold" style={{ width: w(p.soldStock) }} /></div>
      <div className="stock-legend"><span>Total <b>{qty(p.totalStock, p.unit)}</b></span><span>Available <b>{qty(p.availableStock, p.unit)}</b></span><span>Reserved <b>{qty(p.reservedStock, p.unit)}</b></span><span>Sold <b>{qty(p.soldStock, p.unit)}</b></span></div>
    </div>
  );
}
