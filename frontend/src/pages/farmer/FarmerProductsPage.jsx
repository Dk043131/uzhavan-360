import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useMyProducts, useCommerceMutation } from "@/hooks/queries";
import { productsApi } from "@/lib/api";
import { CATEGORIES, CITIES, UNITS, money, qty } from "@/lib/constants";
import { EmptyState, ErrorState, InlineError, LoadingState, PageHeading } from "@/components/common/States";
import { ConfirmDialog, Modal } from "@/components/common/Dialogs";
import { StockBar } from "./FarmerHomePage";

export default function FarmerProductsPage() {
  const q = useMyProducts();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);
  useEffect(() => { if (params.get("new")) { setCreating(true); setParams({}, { replace: true }); } }, [params, setParams]);
  const del = useCommerceMutation((id) => productsApi.remove(id), { onSuccess: () => setDeleting(null) });
  return (
    <div className="resource-page">
      <PageHeading eyebrow="Farm workspace" title="My produce"><button className="primary-button compact" onClick={() => setCreating(true)} data-testid="add-resource-button"><Plus size={16} /> Add produce</button></PageHeading>
      {q.isLoading && <LoadingState />}
      {q.isError && <ErrorState error={q.error} onRetry={q.refetch} />}
      {q.data && q.data.length === 0 && <EmptyState title="No produce listed yet" text="Add your first harvest so buyers nearby can find it." action="Add your first harvest" onAction={() => setCreating(true)} />}
      {q.data && q.data.length > 0 && (
        <div className="card-list" data-testid="my-products-list">
          {q.data.map((p) => (
            <article key={p._id} className="data-card" data-testid={`my-product-${p._id}`}>
              <div className="data-card-head"><div><h3>{p.name}</h3><span className="sub">{p.category} · {money(p.pricePerUnit)}/{String(p.unit).toLowerCase()} · {p.isAvailable && p.availableStock > 0 ? "Live on marketplace" : "Hidden / sold out"} · {p.freshnessTier?.replace(/_/g, " ").toLowerCase()}</span></div>
                <div className="data-card-actions"><button className="ghost-button" onClick={() => setEditing(p)} data-testid={`edit-product-${p._id}`}><Pencil size={14} /> Edit</button><button className="ghost-button" onClick={() => setDeleting(p)} data-testid={`delete-product-${p._id}`}><Trash2 size={14} /> Delete</button></div></div>
              <StockBar p={p} />
              <div className="data-card-actions"><Link to={`/farmer/products/${p._id}`} className="primary-button compact" data-testid={`manage-inventory-${p._id}`}>Inventory & ledger</Link><Link to={`/product/${p._id}`} className="ghost-button" data-testid={`preview-product-${p._id}`}>Buyer view</Link></div>
            </article>
          ))}
        </div>
      )}
      <ProductForm open={creating} onClose={() => setCreating(false)} />
      <ProductForm open={Boolean(editing)} product={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} title={`Delete ${deleting?.name}?`} message="The marketplace blocks deletion while reservations, pending requests or active orders exist. Sold history is kept." confirmLabel="Delete listing" danger pending={del.isPending} error={del.error} onConfirm={() => del.mutate(deleting._id)} testId="delete-product-dialog" />
    </div>
  );
}

function ProductForm({ open, onClose, product }) {
  const { user } = useAuth();
  const edit = Boolean(product);
  const [f, setF] = useState({});
  useEffect(() => { if (open) setF({ name: product?.name || "", category: product?.category || "FRUITING", unit: product?.unit || "KG", pricePerUnit: product?.pricePerUnit || "", quantity: "", harvestDate: new Date().toISOString().slice(0, 10), description: product?.description || "", imageUrl: product?.images?.[0]?.url || "", isAvailable: product?.isAvailable ?? true, city: CITIES[0].name }); }, [open, product]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const save = useCommerceMutation(() => {
    const images = f.imageUrl ? [{ url: f.imageUrl }] : [];
    if (edit) return productsApi.update(product._id, { name: f.name, pricePerUnit: parseFloat(f.pricePerUnit), description: f.description, images, isAvailable: f.isAvailable });
    const farmCoords = user?.farmDetails?.location?.coordinates;
    const city = CITIES.find((c) => c.name === f.city) || CITIES[0];
    const [lng, lat] = farmCoords?.length === 2 ? farmCoords : [city.lng, city.lat];
    return productsApi.create({ name: f.name, category: f.category, unit: f.unit, pricePerUnit: parseFloat(f.pricePerUnit), quantity: parseFloat(f.quantity), harvestDate: f.harvestDate, latitude: lat, longitude: lng, address: user?.farmDetails?.address, description: f.description, images });
  }, { onSuccess: onClose });
  return (
    <Modal open={open} onClose={onClose} title={edit ? `Edit ${product.name}` : "Add produce"} eyebrow={edit ? "Price, story & visibility" : "New harvest listing"} testId="product-form-modal" wide>
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); save.mutate(); }} data-testid="product-form">
        <label className="span-2">Produce name<input required maxLength={120} value={f.name || ""} onChange={set("name")} placeholder="e.g. Country Tomatoes (நாட்டு தக்காளி)" data-testid="product-name-input" /></label>
        {!edit && <label>Category<select value={f.category} onChange={set("category")} data-testid="product-category-input">{CATEGORIES.filter((c) => c.key).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>}
        {!edit && <label>Unit<select value={f.unit} onChange={set("unit")} data-testid="product-unit-input">{UNITS.map((u) => <option key={u}>{u}</option>)}</select></label>}
        <label>Price per unit ₹<input required type="number" min="0.01" step="0.01" value={f.pricePerUnit ?? ""} onChange={set("pricePerUnit")} data-testid="product-price-input" /></label>
        {!edit && <label>Initial quantity<input required type="number" min="0.01" step="0.01" value={f.quantity ?? ""} onChange={set("quantity")} data-testid="product-quantity-input" /><span className="field-hint">Stock changes later go through Inventory (harvest / external sale).</span></label>}
        {!edit && <label>Harvest date<input type="date" value={f.harvestDate || ""} onChange={set("harvestDate")} data-testid="product-harvest-date-input" /></label>}
        {!edit && !user?.farmDetails?.location?.coordinates && <label>Nearest city (map location)<select value={f.city} onChange={set("city")} data-testid="product-city-input">{CITIES.map((c) => <option key={c.name}>{c.name}</option>)}</select></label>}
        <label className="span-2">Image URL <span className="field-hint">(optional — direct uploads are not enabled on the server yet)</span><input type="url" value={f.imageUrl || ""} onChange={set("imageUrl")} placeholder="https://..." data-testid="product-image-input" /></label>
        <label className="span-2">Description<textarea rows={3} maxLength={1000} value={f.description || ""} onChange={set("description")} data-testid="product-description-input" /></label>
        {edit && <label className="checkbox-row span-2"><input type="checkbox" checked={Boolean(f.isAvailable)} onChange={set("isAvailable")} data-testid="product-available-input" /> Visible on marketplace</label>}
        <div className="span-2"><InlineError error={save.error} testId="product-form-error" /></div>
        <div className="dialog-actions span-2"><button type="button" className="outline-button" onClick={onClose} data-testid="product-form-cancel">Cancel</button><button className="primary-button" disabled={save.isPending} data-testid="product-form-submit">{save.isPending ? "Saving..." : edit ? "Save changes" : "Publish listing"}</button></div>
      </form>
    </Modal>
  );
}

export { qty };
