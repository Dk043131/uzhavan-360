import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useRequests, useCommerceMutation } from "@/hooks/queries";
import { ordersApi, requestsApi } from "@/lib/api";
import { money, nameOf, qty, relTime } from "@/lib/constants";
import { EmptyState, ErrorState, InlineError, LoadingState, PageHeading, Pagination, StatusBadge } from "@/components/common/States";
import { ConfirmDialog, Modal } from "@/components/common/Dialogs";

const TABS = [["", "All"], ["REQUESTED", "Awaiting"], ["ACCEPTED", "Confirm quantity"], ["REJECTED", "Declined"], ["CANCELLED", "Cancelled"]];

export default function BuyerRequestsPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const q = useRequests({ status, page, limit: 20 }, Boolean(user));
  const [cancelTarget, setCancelTarget] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const cancel = useCommerceMutation((id) => requestsApi.cancel(id, "Cancelled by buyer"), { onSuccess: () => setCancelTarget(null) });

  return (
    <div className="resource-page">
      <PageHeading eyebrow="Your Uzhavan" title="My requests" />
      <div className="tabs-row" role="tablist">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={status === k} className={status === k ? "active" : ""} onClick={() => { setStatus(k); setPage(1); }} data-testid={`requests-tab-${k || "all"}`}>{l}</button>)}</div>
      {q.isLoading && <LoadingState />}
      {q.isError && <ErrorState error={q.error} onRetry={q.refetch} />}
      {q.data && q.data.items.length === 0 && <EmptyState title="No requests here" text="Requests you send to farmers will appear here." />}
      {q.data && q.data.items.length > 0 && (
        <div className="card-list" data-testid="requests-list">
          {q.data.items.map((r) => {
            const product = r.productId && typeof r.productId === "object" ? r.productId : null;
            const expiresSoon = r.status === "ACCEPTED" && r.expiresAt;
            return (
              <article className="data-card" key={r._id} data-testid={`request-card-${r._id}`}>
                <div className="data-card-head"><div><h3>{product?.name || "Produce"}</h3><span className="sub">Farmer: {nameOf(r.farmerId, "—")} · Sent {relTime(r.createdAt)}</span></div><StatusBadge status={r.status} kind="request" /></div>
                {product && <div className="meta-grid"><div><span>Price</span><strong>{money(product.pricePerUnit)}/{String(product.unit).toLowerCase()}</strong></div><div><span>Available now</span><strong>{qty(product.availableStock, product.unit)}</strong></div>{expiresSoon && <div><span>Confirm before</span><strong>{new Date(r.expiresAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</strong></div>}</div>}
                {r.note && <p className="muted">Your note: “{r.note}”</p>}
                {r.rejectionReason && <p className="muted">Farmer’s reason: {r.rejectionReason}</p>}
                <div className="data-card-actions">
                  {product && <Link className="ghost-button" to={`/product/${product._id}`} data-testid={`request-view-product-${r._id}`}>View produce</Link>}
                  {r.status === "ACCEPTED" && <button className="primary-button compact" onClick={() => setConfirmTarget(r)} data-testid={`request-confirm-quantity-${r._id}`}>Confirm quantity & reserve</button>}
                  {["REQUESTED", "ACCEPTED"].includes(r.status) && <button className="ghost-button" onClick={() => setCancelTarget(r)} data-testid={`request-cancel-${r._id}`}>Cancel request</button>}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {q.data && <Pagination pagination={q.data.pagination} page={page} onChange={setPage} />}
      <ConfirmDialog open={Boolean(cancelTarget)} onClose={() => setCancelTarget(null)} title="Cancel this request?" message="The farmer will be notified. You can send a new request later." confirmLabel="Cancel request" danger pending={cancel.isPending} error={cancel.error} onConfirm={() => cancel.mutate(cancelTarget._id)} testId="cancel-request-dialog" />
      <ConfirmQuantityModal request={confirmTarget} onClose={() => setConfirmTarget(null)} />
    </div>
  );
}

function ConfirmQuantityModal({ request, onClose }) {
  const [quantity, setQuantity] = useState("");
  const [key] = useState(() => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`));
  const [order, setOrder] = useState(null);
  const confirm = useCommerceMutation(({ id, data }) => ordersApi.confirmQuantity(id, data), { onSuccess: (d) => setOrder(d.order) });
  if (!request) return null;
  const product = typeof request.productId === "object" ? request.productId : {};
  const n = parseFloat(quantity);
  const total = n > 0 ? n * product.pricePerUnit : 0;
  return (
    <Modal open onClose={onClose} title={order ? "Stock reserved" : `Confirm quantity — ${product.name}`} eyebrow={order ? "Order created" : "Step 2 of 2"} testId="confirm-quantity-modal">
      {order ? (
        <div className="stack-form" data-testid="confirm-quantity-success"><p>The farmer reserved <strong>{qty(order.reservedQuantity, order.unit)}</strong> for you. Total at farmgate: <span className="price-total">{money(order.totalAmount)}</span></p><p className="muted">Pickup within 12 hours or the reservation expires and stock is released. Order status: <StatusBadge status={order.status} /></p><div className="dialog-actions"><Link to={`/orders/${order._id}`} className="primary-button" data-testid="view-order-link">View order</Link></div></div>
      ) : (
        <>
          <p className="muted">Farmer has {qty(product.availableStock, product.unit)} available at {money(product.pricePerUnit)}/{String(product.unit).toLowerCase()}. The backend will reserve exactly what you confirm.</p>
          <div className="stack-form"><label>Quantity ({String(product.unit).toLowerCase()})<input type="number" min="0.01" step="0.01" max={product.availableStock} value={quantity} onChange={(e) => setQuantity(e.target.value)} data-testid="confirm-quantity-input" autoFocus /></label>{n > 0 && <div className="price-total" data-testid="confirm-quantity-total">{money(total)}</div>}</div>
          <InlineError error={confirm.error} testId="confirm-quantity-error" />
          <div className="dialog-actions"><button className="outline-button" onClick={onClose} data-testid="confirm-quantity-cancel">Back</button><button className="primary-button" disabled={!(n > 0) || confirm.isPending} onClick={() => confirm.mutate({ id: request._id, data: { quantity: n, idempotencyKey: key } })} data-testid="confirm-quantity-submit">{confirm.isPending ? "Reserving..." : "Reserve stock"}</button></div>
        </>
      )}
    </Modal>
  );
}
