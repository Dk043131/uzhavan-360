import { useState } from "react";
import { useRequests, useCommerceMutation } from "@/hooks/queries";
import { requestsApi } from "@/lib/api";
import { money, nameOf, qty, relTime } from "@/lib/constants";
import { EmptyState, ErrorState, LoadingState, PageHeading, Pagination, StatusBadge } from "@/components/common/States";
import { ConfirmDialog } from "@/components/common/Dialogs";

const TABS = [["", "All"], ["REQUESTED", "Needs decision"], ["ACCEPTED", "Awaiting quantity"], ["RESERVED", "Reserved"], ["REJECTED", "Declined"]];

export default function FarmerRequestsPage() {
  const [status, setStatus] = useState("REQUESTED");
  const [page, setPage] = useState(1);
  const q = useRequests({ status, page, limit: 20 });
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");
  const accept = useCommerceMutation((id) => requestsApi.accept(id));
  const reject = useCommerceMutation(({ id, r }) => requestsApi.reject(id, r), { onSuccess: () => { setRejecting(null); setReason(""); } });
  return (
    <div className="resource-page">
      <PageHeading eyebrow="Farm workspace" title="Incoming requests" />
      <div className="tabs-row" role="tablist">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={status === k} className={status === k ? "active" : ""} onClick={() => { setStatus(k); setPage(1); }} data-testid={`farmer-requests-tab-${k || "all"}`}>{l}</button>)}</div>
      {q.isLoading && <LoadingState />}
      {q.isError && <ErrorState error={q.error} onRetry={q.refetch} />}
      {q.data && q.data.items.length === 0 && <EmptyState title="No requests in this view" text="New buyer requests will appear here and in your notifications." />}
      {q.data && q.data.items.length > 0 && (
        <div className="card-list" data-testid="farmer-requests-list">
          {q.data.items.map((r) => {
            const product = typeof r.productId === "object" ? r.productId : null;
            const buyer = typeof r.buyerId === "object" ? r.buyerId : null;
            const busy = accept.isPending && accept.variables === r._id;
            return (
              <article key={r._id} className="data-card" data-testid={`farmer-request-${r._id}`}>
                <div className="data-card-head"><div><h3>{product?.name || "Produce"}</h3><span className="sub">From {buyer?.name || "buyer"}{buyer?.buyerDetails?.businessType ? ` (${buyer.buyerDetails.businessType.toLowerCase()})` : ""} · {relTime(r.createdAt)}</span></div><StatusBadge status={r.status} kind="request" /></div>
                {product && <div className="meta-grid"><div><span>Your price</span><strong>{money(product.pricePerUnit)}/{String(product.unit).toLowerCase()}</strong></div><div><span>Available</span><strong>{qty(product.availableStock, product.unit)}</strong></div>{buyer?.buyerDetails && <div><span>Buyer no-shows</span><strong>{buyer.buyerDetails.noShowCount ?? 0}</strong></div>}</div>}
                {r.note && <p className="muted">Buyer note: “{r.note}”</p>}
                {r.status === "REQUESTED" && <div className="data-card-actions"><button className="primary-button compact" disabled={busy} onClick={() => accept.mutate(r._id)} data-testid={`accept-request-${r._id}`}>{busy ? "Accepting..." : "Accept"}</button><button className="ghost-button" onClick={() => setRejecting(r)} data-testid={`reject-request-${r._id}`}>Decline</button></div>}
                {r.status === "ACCEPTED" && <p className="muted">Waiting for {nameOf(r.buyerId, "buyer")} to confirm quantity (expires {new Date(r.expiresAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}). Stock is reserved only after confirmation.</p>}
                {accept.isError && accept.variables === r._id && <div className="error-box" role="alert" data-testid={`accept-error-${r._id}`}>{accept.error.message}</div>}
              </article>
            );
          })}
        </div>
      )}
      {q.data && <Pagination pagination={q.data.pagination} page={page} onChange={setPage} />}
      <ConfirmDialog open={Boolean(rejecting)} onClose={() => setRejecting(null)} title="Decline this request?" confirmLabel="Decline request" danger pending={reject.isPending} error={reject.error} onConfirm={() => reject.mutate({ id: rejecting._id, r: reason || undefined })} testId="reject-request-dialog">
        <div className="stack-form"><label>Reason for the buyer (optional)<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Already committed this batch" data-testid="reject-reason-input" /></label></div>
      </ConfirmDialog>
    </div>
  );
}
