import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ChevronRight, ShieldCheck, Sprout } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useProduct, useCommerceMutation } from "@/hooks/queries";
import { requestsApi } from "@/lib/api";
import { cropName, imageFor, money, qty } from "@/lib/constants";
import { ErrorState, InlineError } from "@/components/common/States";
import { Modal } from "@/components/common/Dialogs";

export default function ProductDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const q = useProduct(id);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(null);
  const create = useCommerceMutation((data) => requestsApi.create(data), { onSuccess: (d) => { setSent(d.request); setOpen(false); } });

  if (q.isLoading) return <div className="state-box" data-testid="product-loading"><div className="spinner" /><p>Loading harvest details...</p></div>;
  if (q.isError) return <ErrorState error={q.error} onRetry={q.refetch} />;
  const p = q.data;
  const farmer = p.farmerId && typeof p.farmerId === "object" ? p.farmerId : null;
  const out = p.availableStock <= 0 || !p.isAvailable;
  const isBuyer = user?.role === "ROLE_BUYER";
  const fresh = p.freshnessTier === "FRESH_HARVEST" ? "Fresh harvest" : p.freshnessTier === "SELL_SOON" ? "Sell soon — best price" : "Good condition";
  const onRequest = () => { if (!user) return navigate("/login", { state: { from: `/product/${id}` } }); setOpen(true); };

  return (
    <div className="detail-page">
      <Link to="/" className="back-link" data-testid="product-detail-back-link"><ArrowLeft size={16} /> Back to market</Link>
      <div className="detail-layout">
        <div className="detail-photo"><img src={imageFor(p)} alt={p.name} /><span className="photo-label">{fresh}</span></div>
        <div className="detail-copy">
          <span className="eyebrow">{p.category}</span>
          <h1 data-testid="product-name">{p.name}<small>{cropName(p.name)}</small></h1>
          <div className="detail-price" data-testid="product-price">{money(p.pricePerUnit)} <span>/ {String(p.unit).toLowerCase()}</span></div>
          <div className="meta-grid" data-testid="product-stock">
            <div><span>Available</span><strong>{qty(p.availableStock, p.unit)}</strong></div>
            <div><span>Harvested</span><strong>{new Date(p.harvestDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</strong></div>
            <div><span>Freshness</span><strong>{Math.round((p.freshnessScore || 0) * 100)}%</strong></div>
          </div>
          <div className="freshness-meter"><div className="meter-label"><span>Freshness</span><strong>{fresh}</strong></div><div className="meter-track"><i style={{ width: `${Math.round((p.freshnessScore || 0) * 100)}%` }} /></div></div>
          <p className="detail-description">{p.description || "A careful harvest from a nearby farm. Request directly and confirm the quantity after the farmer accepts."}</p>
          {farmer && (
            <Link to={`/farmers/${farmer._id}`} className="farmer-card" data-testid="product-farmer-link">
              <div className="farmer-avatar"><Sprout /></div>
              <div><span className="muted">Grown by</span><strong>{farmer.farmDetails?.farmName || farmer.name}</strong>{farmer.isVerified ? <span className="verified"><ShieldCheck size={14} /> Verified farmer</span> : <span className="muted">{farmer.farmDetails?.address?.district || "Tamil Nadu"}</span>}</div>
              <ChevronRight size={18} />
            </Link>
          )}
          {sent ? (
            <div className="detail-actions"><button className="primary-button request-button" disabled data-testid="request-sent-button"><CheckCircle2 size={18} /> Request sent — awaiting farmer</button><Link to="/requests" className="outline-button full-width" data-testid="view-my-requests-link">Track in My requests</Link></div>
          ) : (
            <button className="primary-button request-button" disabled={out || (user && !isBuyer)} onClick={onRequest} data-testid="request-from-farmer-button">{out ? "Currently sold out" : user && !isBuyer ? "Only buyers can request produce" : "Request from farmer"}</button>
          )}
          <span className="helper-text">No stock is reserved yet — you confirm the quantity after the farmer accepts (within 12 hours).</span>
        </div>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={`Request ${p.name}`} eyebrow="Step 1 of 2" testId="request-modal">
        <p className="muted">Tell the farmer roughly what you need. Quantity is confirmed only after acceptance.</p>
        <div className="stack-form"><label>Note to farmer (optional)<textarea rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Need around 20 kg for Saturday" data-testid="request-note-input" /></label></div>
        <InlineError error={create.error} testId="request-error" />
        <div className="dialog-actions"><button className="outline-button" onClick={() => setOpen(false)} data-testid="request-cancel-button">Not now</button><button className="primary-button" disabled={create.isPending} onClick={() => create.mutate({ productId: id, note: note || undefined })} data-testid="request-submit-button">{create.isPending ? "Sending..." : "Send request"}</button></div>
      </Modal>
    </div>
  );
}
