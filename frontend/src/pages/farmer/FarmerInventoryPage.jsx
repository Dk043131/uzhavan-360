import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useInventoryHistory, useMyProducts, useCommerceMutation } from "@/hooks/queries";
import { inventoryApi } from "@/lib/api";
import { qty, relTime } from "@/lib/constants";
import { EmptyState, ErrorState, InlineError, LoadingState, PageHeading } from "@/components/common/States";
import { ConfirmDialog, Modal } from "@/components/common/Dialogs";
import { StockBar } from "./FarmerHomePage";

const TYPE_LABEL = { NEW_HARVEST: "New harvest", INITIAL_LISTING: "Initial listing", BATCH_ADDITION: "Harvest added", RESERVATION: "Reserved for order", RESERVE_STOCK: "Reserved for order", RESERVATION_RELEASE: "Reservation released", RELEASE_RESERVATION: "Reservation released", SALE: "Sold via order", CONFIRM_SALE: "Sold via order", OFF_PLATFORM_SALE: "External sale", OFFLINE_SALE: "External sale", STOCK_CORRECTION: "Stock correction", STOCK_CORRECTION_LOSS: "Loss correction", ADJUSTMENT: "Adjustment" };

export default function FarmerInventoryPage() {
  const { id } = useParams();
  const products = useMyProducts();
  const history = useInventoryHistory(id);
  const product = products.data?.find((p) => p._id === id);
  const [harvest, setHarvest] = useState(false);
  const [sale, setSale] = useState(false);
  if (products.isLoading) return <LoadingState />;
  if (products.isError) return <ErrorState error={products.error} onRetry={products.refetch} />;
  if (!product) return <EmptyState title="Product not found" text="It may have been deleted." />;
  return (
    <div className="resource-page" data-testid="inventory-page">
      <Link to="/farmer/products" className="back-link" data-testid="inventory-back-link"><ArrowLeft size={16} /> My produce</Link>
      <PageHeading eyebrow="Inventory ledger" title={product.name}>
        <div className="data-card-actions"><button className="primary-button compact" onClick={() => setHarvest(true)} data-testid="add-harvest-button">Add harvest</button><button className="outline-button compact" onClick={() => setSale(true)} data-testid="external-sale-button">Record external sale</button></div>
      </PageHeading>
      <div className="data-card" data-testid="inventory-stock-card">
        <div className="meta-grid"><div><span>Total</span><strong data-testid="stock-total">{qty(product.totalStock, product.unit)}</strong></div><div><span>Available</span><strong data-testid="stock-available">{qty(product.availableStock, product.unit)}</strong></div><div><span>Reserved</span><strong data-testid="stock-reserved">{qty(product.reservedStock, product.unit)}</strong></div><div><span>Sold</span><strong data-testid="stock-sold">{qty(product.soldStock, product.unit)}</strong></div></div>
        <StockBar p={product} />
        <p className="field-hint">Total = available + reserved + sold. All figures come from the marketplace ledger.</p>
      </div>
      <h3 className="section-title">Ledger history</h3>
      {history.isLoading && <LoadingState />}
      {history.isError && <ErrorState error={history.error} onRetry={history.refetch} />}
      {history.data && history.data.length === 0 && <EmptyState title="No ledger entries yet" />}
      {history.data && history.data.length > 0 && (
        <div className="table-wrap"><table className="data-table" data-testid="ledger-table"><thead><tr><th>When</th><th>Type</th><th>Change</th><th>Available</th><th>Reserved</th><th>Sold</th><th>Note</th></tr></thead><tbody>{history.data.map((h) => <tr key={h._id} data-testid={`ledger-row-${h._id}`}><td>{relTime(h.createdAt)}</td><td>{TYPE_LABEL[h.transactionType] || h.transactionType}</td><td style={{ color: h.quantityDelta < 0 ? "#991b1b" : "#166534", fontWeight: 700 }}>{h.quantityDelta > 0 ? "+" : ""}{h.quantityDelta}</td><td>{h.availableBefore} → {h.availableAfter}</td><td>{h.reservedBefore} → {h.reservedAfter}</td><td>{h.soldBefore} → {h.soldAfter}</td><td className="muted">{h.reason || h.referenceId || ""}</td></tr>)}</tbody></table></div>
      )}
      <QuantityDialog open={harvest} onClose={() => setHarvest(false)} product={product} title="Add new harvest" label="Harvest quantity" confirmLabel="Add to stock" mutationFn={(data) => inventoryApi.addHarvest(data)} testId="add-harvest-dialog" />
      <QuantityDialog open={sale} onClose={() => setSale(false)} product={product} title="Record external (off-platform) sale" label="Quantity sold outside Uzhavan" confirmLabel="Record sale" danger max={product.availableStock} mutationFn={(data) => inventoryApi.offPlatformSale(data)} testId="external-sale-dialog" />
    </div>
  );
}

function QuantityDialog({ open, onClose, product, title, label, confirmLabel, mutationFn, danger, max, testId }) {
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [result, setResult] = useState(null);
  const m = useCommerceMutation(mutationFn, { onSuccess: (d) => setResult(d.product) });
  const close = () => { setQuantity(""); setReason(""); setResult(null); m.reset(); onClose(); };
  const n = parseFloat(quantity);
  if (result) {
    return <Modal open onClose={close} title="Inventory updated" eyebrow="Marketplace confirmed" testId={`${testId}-success`}><div className="meta-grid"><div><span>Total</span><strong>{qty(result.totalStock, result.unit)}</strong></div><div><span>Available</span><strong>{qty(result.availableStock, result.unit)}</strong></div><div><span>Reserved</span><strong>{qty(result.reservedStock, result.unit)}</strong></div><div><span>Sold</span><strong>{qty(result.soldStock, result.unit)}</strong></div></div><div className="dialog-actions"><button className="primary-button" onClick={close} data-testid={`${testId}-done`}>Done</button></div></Modal>;
  }
  return (
    <ConfirmDialog open={open} onClose={close} title={title} confirmLabel={confirmLabel} danger={danger} pending={m.isPending} error={m.error} onConfirm={() => m.mutate({ productId: product._id, quantity: n, reason: reason || undefined })} testId={testId}>
      <div className="stack-form"><label>{label} ({String(product.unit).toLowerCase()})<input type="number" min="0.01" step="0.01" max={max} value={quantity} onChange={(e) => setQuantity(e.target.value)} data-testid={`${testId}-quantity`} autoFocus />{max !== undefined && <span className="field-hint">Available now: {qty(max, product.unit)}</span>}</label><label>Note (optional)<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Morning harvest / Sandhai sale" data-testid={`${testId}-reason`} /></label></div>
      {!(n > 0) && <InlineError error={quantity ? { message: "Enter a quantity greater than zero." } : null} />}
    </ConfirmDialog>
  );
}
