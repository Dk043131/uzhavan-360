import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useByproducts, useMyByproducts } from "@/hooks/queries";
import { byproductsApi } from "@/lib/api";
import { BYPRODUCT_CATEGORIES, CITIES, UNITS, money, qty, relTime } from "@/lib/constants";
import { EmptyState, ErrorState, InlineError, LoadingState, PageHeading, Pagination } from "@/components/common/States";
import { ConfirmDialog, Modal } from "@/components/common/Dialogs";

const label = (s) => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

export default function ByproductsPage() {
  const { place } = useOutletContext();
  const { user } = useAuth();
  const center = place || CITIES[0];
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const params = useMemo(() => ({ lat: center.lat, lng: center.lng, radius: 300, category, search, page, limit: 20 }), [center, category, search, page]);
  const q = useByproducts(params);
  const isFarmer = user?.role === "ROLE_FARMER";
  const [create, setCreate] = useState(false);
  return (
    <div className="resource-page">
      <PageHeading eyebrow="Circular farming" title="Harvest byproducts">{isFarmer && <button className="primary-button compact" onClick={() => setCreate(true)} data-testid="add-byproduct-button"><Plus size={16} /> List byproduct</button>}</PageHeading>
      <p className="muted">Straw, shells, bagasse and residues from farms near {center.name}. Contact details are shared by the farmer directly — the marketplace does not yet process byproduct orders.</p>
      <div className="filters-bar"><input placeholder="Search byproducts" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} aria-label="Search byproducts" data-testid="byproducts-search-input" /><select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} aria-label="Category" data-testid="byproducts-category-select"><option value="">All categories</option>{BYPRODUCT_CATEGORIES.map((c) => <option key={c} value={c}>{label(c)}</option>)}</select></div>
      {q.isLoading && <LoadingState />}
      {q.isError && <ErrorState error={q.error} onRetry={q.refetch} />}
      {q.data && q.data.items.length === 0 && <EmptyState title="No byproducts nearby" text="Farmers list residues here as harvests finish." />}
      {q.data && q.data.items.length > 0 && <div className="card-list" data-testid="byproducts-list">{q.data.items.map((b) => <article key={b._id} className="data-card" data-testid={`byproduct-card-${b._id}`}><div className="data-card-head"><div><h3>{b.name}</h3><span className="sub">{label(b.category)} · {b.farmerId?.farmDetails?.farmName || b.farmerId?.name || "Local farm"} · ~{b.distanceKm} km</span></div><strong>{b.expectedPrice ? `${money(b.expectedPrice)}/${String(b.unit).toLowerCase()}` : "Price on request"}</strong></div><div className="meta-grid"><div><span>Quantity</span><strong>{qty(b.quantity, b.unit)}</strong></div><div><span>Packaging</span><strong>{label(b.packagingType || "LOOSE")}</strong></div><div><span>Moisture</span><strong>{label(b.moistureLevel || "UNSPECIFIED")}</strong></div><div><span>Listed</span><strong>{relTime(b.createdAt)}</strong></div></div>{b.potentialUses?.length > 0 && <p className="muted">Uses: {b.potentialUses.join(", ")}</p>}{b.description && <p className="muted">{b.description}</p>}</article>)}</div>}
      {q.data && <Pagination pagination={q.data.pagination} page={page} onChange={setPage} />}
      {isFarmer && <MyByproducts />}
      {isFarmer && <ByproductForm open={create} onClose={() => setCreate(false)} center={center} />}
    </div>
  );
}

function MyByproducts() {
  const q = useMyByproducts();
  const qc = useQueryClient();
  const [target, setTarget] = useState(null);
  const del = useMutation({ mutationFn: (id) => byproductsApi.remove(id), onSuccess: () => { setTarget(null); qc.invalidateQueries({ queryKey: ["my-byproducts"] }); qc.invalidateQueries({ queryKey: ["byproducts"] }); } });
  return (
    <section>
      <h3 className="section-title">My byproduct listings</h3>
      {q.isLoading && <LoadingState rows={1} />}
      {q.isError && <ErrorState error={q.error} onRetry={q.refetch} />}
      {q.data && q.data.length === 0 && <p className="muted" data-testid="my-byproducts-empty">You haven’t listed any byproducts yet.</p>}
      {q.data && q.data.length > 0 && <div className="card-list" data-testid="my-byproducts-list">{q.data.map((b) => <div key={b._id} className="data-card"><div className="data-card-head"><div><h3>{b.name}</h3><span className="sub">{qty(b.quantity, b.unit)} · {b.status}</span></div><button className="ghost-button" onClick={() => setTarget(b)} data-testid={`byproduct-delete-${b._id}`}><Trash2 size={14} /> Remove</button></div></div>)}</div>}
      <ConfirmDialog open={Boolean(target)} onClose={() => setTarget(null)} title="Remove this listing?" message={target?.name} confirmLabel="Remove" danger pending={del.isPending} error={del.error} onConfirm={() => del.mutate(target._id)} testId="delete-byproduct-dialog" />
    </section>
  );
}

function ByproductForm({ open, onClose, center }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ name: "", category: "PADDY_STRAW", quantity: "", unit: "TON", expectedPrice: "", packagingType: "LOOSE", moistureLevel: "UNSPECIFIED", description: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const create = useMutation({ mutationFn: () => byproductsApi.create({ ...f, quantity: parseFloat(f.quantity), expectedPrice: f.expectedPrice ? parseFloat(f.expectedPrice) : 0, latitude: center.lat, longitude: center.lng }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["byproducts"] }); qc.invalidateQueries({ queryKey: ["my-byproducts"] }); onClose(); } });
  return (
    <Modal open={open} onClose={onClose} title="List a harvest byproduct" eyebrow="Circular farming" testId="byproduct-modal" wide>
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); create.mutate(); }} data-testid="byproduct-form">
        <label>Name<input required value={f.name} onChange={set("name")} data-testid="byproduct-name-input" /></label>
        <label>Category<select value={f.category} onChange={set("category")} data-testid="byproduct-category-input">{BYPRODUCT_CATEGORIES.map((c) => <option key={c} value={c}>{label(c)}</option>)}</select></label>
        <label>Quantity<input required type="number" min="0.1" step="0.1" value={f.quantity} onChange={set("quantity")} data-testid="byproduct-quantity-input" /></label>
        <label>Unit<select value={f.unit} onChange={set("unit")} data-testid="byproduct-unit-input">{UNITS.map((u) => <option key={u}>{u}</option>)}</select></label>
        <label>Expected price ₹/unit<input type="number" min="0" value={f.expectedPrice} onChange={set("expectedPrice")} data-testid="byproduct-price-input" /></label>
        <label>Packaging<select value={f.packagingType} onChange={set("packagingType")} data-testid="byproduct-packaging-input">{["BALED", "LOOSE", "BAGGED", "OTHER"].map((u) => <option key={u}>{u}</option>)}</select></label>
        <label>Moisture<select value={f.moistureLevel} onChange={set("moistureLevel")} data-testid="byproduct-moisture-input">{["LOW", "MEDIUM", "HIGH", "UNSPECIFIED"].map((u) => <option key={u}>{u}</option>)}</select></label>
        <label className="span-2">Description<textarea rows={2} value={f.description} onChange={set("description")} data-testid="byproduct-description-input" /></label>
        <div className="span-2"><InlineError error={create.error} testId="byproduct-error" /></div>
        <div className="dialog-actions span-2"><button type="button" className="outline-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={create.isPending} data-testid="byproduct-submit-button">{create.isPending ? "Listing..." : "List byproduct"}</button></div>
      </form>
    </Modal>
  );
}
