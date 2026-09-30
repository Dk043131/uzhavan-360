import { useState } from "react";
import { Link } from "react-router-dom";
import { useOrders, useCommerceMutation } from "@/hooks/queries";
import { ordersApi } from "@/lib/api";
import { nameOf, qty, relTime } from "@/lib/constants";
import { EmptyState, ErrorState, InlineError, LoadingState, PageHeading, Pagination, StatusBadge } from "@/components/common/States";
import { ConfirmDialog } from "@/components/common/Dialogs";
import { OrderSummary } from "../BuyerOrdersPage";

const TABS = [["", "All"], ["RESERVED", "Reserved"], ["PREPARING", "Preparing"], ["READY_FOR_PICKUP", "Ready"], ["COMPLETED", "Completed"], ["COMPLETED_PARTIAL", "Partial"], ["NO_SHOW", "No-show"]];

export default function FarmerOrdersPage() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const q = useOrders({ status, page, limit: 20 });
  return (
    <div className="resource-page">
      <PageHeading eyebrow="Farm workspace" title="Farm orders" />
      <div className="tabs-row" role="tablist">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={status === k} className={status === k ? "active" : ""} onClick={() => { setStatus(k); setPage(1); }} data-testid={`farmer-orders-tab-${k || "all"}`}>{l}</button>)}</div>
      {q.isLoading && <LoadingState />}
      {q.isError && <ErrorState error={q.error} onRetry={q.refetch} />}
      {q.data && q.data.items.length === 0 && <EmptyState title="No orders in this view" text="When buyers confirm a quantity, the reserved order appears here." />}
      {q.data && q.data.items.length > 0 && <div className="card-list" data-testid="farmer-orders-list">{q.data.items.map((o) => <article key={o._id} className="data-card" data-testid={`farmer-order-${o._id}`}><div className="data-card-head"><div><h3>{nameOf(o.productId, "Produce")}</h3><span className="sub">Buyer: {nameOf(o.buyerId, "—")} · {relTime(o.createdAt)}</span></div><StatusBadge status={o.status} /></div><OrderSummary order={o} /><FarmerOrderActions order={o} /><Link to={`/orders/${o._id}`} className="link-button" data-testid={`farmer-order-detail-${o._id}`}>Full details</Link></article>)}</div>}
      {q.data && <Pagination pagination={q.data.pagination} page={page} onChange={setPage} />}
    </div>
  );
}

export function FarmerOrderActions({ order: o }) {
  const [dialog, setDialog] = useState(null);
  const [fulfilled, setFulfilled] = useState("");
  const [reason, setReason] = useState("");
  const close = () => { setDialog(null); setFulfilled(""); setReason(""); };
  const status = useCommerceMutation((s) => ordersApi.updateStatus(o._id, s));
  const complete = useCommerceMutation((fq) => ordersApi.complete(o._id, fq), { onSuccess: close });
  const noShow = useCommerceMutation(() => ordersApi.noShow(o._id), { onSuccess: close });
  const cancel = useCommerceMutation((r) => ordersApi.cancelByFarmer(o._id, r), { onSuccess: close });
  const active = ["RESERVED", "PREPARING", "READY_FOR_PICKUP"].includes(o.status);
  if (!active) return null;
  const fq = fulfilled === "" ? o.reservedQuantity : parseFloat(fulfilled);
  const partial = fq > 0 && fq < o.reservedQuantity;
  return (
    <>
      <div className="data-card-actions" data-testid={`farmer-order-actions-${o._id}`}>
        {o.status === "RESERVED" && <button className="ghost-button" disabled={status.isPending} onClick={() => status.mutate("PREPARING")} data-testid={`order-preparing-${o._id}`}>Start preparing</button>}
        {o.status === "PREPARING" && <button className="ghost-button" disabled={status.isPending} onClick={() => status.mutate("READY_FOR_PICKUP")} data-testid={`order-ready-${o._id}`}>Mark ready for pickup</button>}
        <button className="primary-button compact" onClick={() => setDialog("complete")} data-testid={`order-complete-${o._id}`}>Complete handover</button>
        {["RESERVED", "READY_FOR_PICKUP"].includes(o.status) && <button className="ghost-button" onClick={() => setDialog("noshow")} data-testid={`order-noshow-${o._id}`}>Buyer no-show</button>}
        <button className="ghost-button" onClick={() => setDialog("cancel")} data-testid={`order-farmer-cancel-${o._id}`}>Cancel order</button>
      </div>
      <InlineError error={status.error} testId={`order-status-error-${o._id}`} />
      <ConfirmDialog open={dialog === "complete"} onClose={close} title="Complete this order" confirmLabel={partial ? `Complete partially (${qty(fq, o.unit)})` : "Complete in full"} pending={complete.isPending} error={complete.error} onConfirm={() => complete.mutate(fulfilled === "" ? undefined : fq)} testId="complete-order-dialog">
        <div className="stack-form"><label>Quantity actually handed over ({String(o.unit).toLowerCase()})<input type="number" min="0.01" step="0.01" max={o.reservedQuantity} value={fulfilled} onChange={(e) => setFulfilled(e.target.value)} placeholder={String(o.reservedQuantity)} data-testid="complete-quantity-input" /><span className="field-hint">Reserved: {qty(o.reservedQuantity, o.unit)}. Leave empty for full completion. Any shortfall is released back to available stock by the marketplace.</span></label></div>
        {partial && <p className="muted" data-testid="partial-warning">This will be recorded as a <strong>partial completion</strong> — shortfall {qty(o.reservedQuantity - fq, o.unit)}.</p>}
      </ConfirmDialog>
      <ConfirmDialog open={dialog === "noshow"} onClose={close} title="Mark buyer as no-show?" message="Reserved stock returns to available inventory and the buyer’s no-show count increases." confirmLabel="Mark no-show" danger pending={noShow.isPending} error={noShow.error} onConfirm={() => noShow.mutate()} testId="noshow-dialog" />
      <ConfirmDialog open={dialog === "cancel"} onClose={close} title="Cancel this order?" confirmLabel="Cancel order" danger pending={cancel.isPending} error={cancel.error} onConfirm={() => cancel.mutate(reason)} testId="farmer-cancel-dialog">
        <div className="stack-form"><label>Operational reason (required)<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Crop damaged by rain" data-testid="farmer-cancel-reason-input" /></label></div>
      </ConfirmDialog>
    </>
  );
}
