import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useOrders, useCommerceMutation } from "@/hooks/queries";
import { ordersApi } from "@/lib/api";
import { ACTIVE_ORDER_STATES, money, nameOf, qty, relTime } from "@/lib/constants";
import { EmptyState, ErrorState, LoadingState, PageHeading, Pagination, StatusBadge } from "@/components/common/States";
import { ConfirmDialog } from "@/components/common/Dialogs";

export function OrderSummary({ order }) {
  const partial = order.status === "COMPLETED_PARTIAL";
  const done = ["COMPLETED", "COMPLETED_PARTIAL"].includes(order.status);
  return (
    <div className="meta-grid" data-testid={`order-summary-${order._id}`}>
      <div><span>Reserved</span><strong>{qty(order.reservedQuantity, order.unit)}</strong></div>
      {done && <div><span>Fulfilled</span><strong>{qty(order.fulfilledQuantity, order.unit)}</strong></div>}
      {partial && <div><span>Shortfall</span><strong style={{ color: "#9a3412" }}>{qty(order.reservedQuantity - order.fulfilledQuantity, order.unit)}</strong></div>}
      <div><span>Unit price</span><strong>{money(order.unitPrice)}</strong></div>
      <div><span>{done ? "Billed total" : "Estimated total"}</span><strong>{money(order.totalAmount)}</strong></div>
      {!done && ACTIVE_ORDER_STATES.includes(order.status) && order.reservationExpiresAt && <div><span>Reservation ends</span><strong>{new Date(order.reservationExpiresAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</strong></div>}
    </div>
  );
}

const TABS = [["", "All"], ["RESERVED", "Reserved"], ["READY_FOR_PICKUP", "Ready"], ["COMPLETED", "Completed"], ["COMPLETED_PARTIAL", "Partial"]];

export default function BuyerOrdersPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const q = useOrders({ status, page, limit: 20 }, Boolean(user));
  const [cancelTarget, setCancelTarget] = useState(null);
  const cancel = useCommerceMutation((id) => ordersApi.cancelByBuyer(id, "Cancelled by buyer"), { onSuccess: () => setCancelTarget(null) });
  return (
    <div className="resource-page">
      <PageHeading eyebrow="Your Uzhavan" title="Orders & tracking" />
      <div className="tabs-row" role="tablist">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={status === k} className={status === k ? "active" : ""} onClick={() => { setStatus(k); setPage(1); }} data-testid={`orders-tab-${k || "all"}`}>{l}</button>)}</div>
      {q.isLoading && <LoadingState />}
      {q.isError && <ErrorState error={q.error} onRetry={q.refetch} />}
      {q.data && q.data.items.length === 0 && <EmptyState title="No orders yet" text="Once a farmer accepts your request and you confirm a quantity, the reserved order appears here." />}
      {q.data && q.data.items.length > 0 && (
        <div className="card-list" data-testid="orders-list">
          {q.data.items.map((o) => (
            <article className="data-card" key={o._id} data-testid={`order-card-${o._id}`}>
              <div className="data-card-head"><div><h3>{nameOf(o.productId, "Produce")}</h3><span className="sub">Farmer: {nameOf(o.farmerId, "—")} · {relTime(o.createdAt)}</span></div><StatusBadge status={o.status} /></div>
              <OrderSummary order={o} />
              <div className="data-card-actions"><Link to={`/orders/${o._id}`} className="ghost-button" data-testid={`order-view-${o._id}`}>Order details</Link>{o.status === "RESERVED" && <button className="ghost-button" onClick={() => setCancelTarget(o)} data-testid={`order-cancel-${o._id}`}>Cancel order</button>}</div>
            </article>
          ))}
        </div>
      )}
      {q.data && <Pagination pagination={q.data.pagination} page={page} onChange={setPage} />}
      <ConfirmDialog open={Boolean(cancelTarget)} onClose={() => setCancelTarget(null)} title="Cancel this order?" message="Reserved stock will be released back to the farmer by the marketplace." confirmLabel="Cancel order" danger pending={cancel.isPending} error={cancel.error} onConfirm={() => cancel.mutate(cancelTarget._id)} testId="cancel-order-dialog" />
    </div>
  );
}
