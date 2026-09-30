import { Link, useParams } from "react-router-dom";
import { ArrowLeft, MapPin } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useOrder } from "@/hooks/queries";
import { nameOf, relTime } from "@/lib/constants";
import { ErrorState, LoadingState, PageHeading, StatusBadge } from "@/components/common/States";
import { OrderSummary } from "./BuyerOrdersPage";
import { FarmerOrderActions } from "./farmer/FarmerOrdersPage";

const STEPS = ["RESERVED", "PREPARING", "READY_FOR_PICKUP", "COMPLETED"];

export default function OrderDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const q = useOrder(id);
  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState error={q.error} onRetry={q.refetch} />;
  const o = q.data;
  const product = typeof o.productId === "object" ? o.productId : null;
  const stepIndex = o.status === "COMPLETED_PARTIAL" ? 3 : STEPS.indexOf(o.status);
  const isFarmer = user?.role === "ROLE_FARMER";
  const back = isFarmer ? "/farmer/orders" : "/orders";
  return (
    <div className="resource-page" data-testid="order-detail-page">
      <Link to={back} className="back-link" data-testid="order-back-link"><ArrowLeft size={16} /> Back to orders</Link>
      <PageHeading eyebrow={`Order · ${relTime(o.createdAt)}`} title={product?.name || "Order"}><StatusBadge status={o.status} /></PageHeading>
      {stepIndex >= 0 && (
        <div className="tabs-row" aria-label="Order progress" data-testid="order-progress">{STEPS.map((s, i) => <button key={s} className={i <= stepIndex ? "active" : ""} disabled aria-current={i === stepIndex}>{i + 1}. {s.replace(/_/g, " ").toLowerCase()}</button>)}</div>
      )}
      <div className="two-col">
        <div className="data-card">
          <OrderSummary order={o} />
          {o.status === "COMPLETED_PARTIAL" && <p className="muted" data-testid="partial-notice">This order was completed partially: the farmer handed over {o.fulfilledQuantity} of {o.reservedQuantity} {String(o.unit).toLowerCase()}. Billing reflects the fulfilled amount only.</p>}
          {o.cancellationReason && <p className="muted">Reason: {o.cancellationReason}</p>}
          {o.notes && <p className="muted">Notes: {o.notes}</p>}
          {isFarmer && <FarmerOrderActions order={o} />}
        </div>
        <aside>
          <div className="data-card"><span className="eyebrow">{isFarmer ? "Buyer" : "Farmer"}</span><strong>{nameOf(isFarmer ? o.buyerId : o.farmerId, "—")}</strong>{!isFarmer && typeof o.farmerId === "object" && o.farmerId.phone && <span className="muted">Contact: {o.farmerId.phone}</span>}</div>
          {o.pickupLocation?.address && <div className="data-card"><span className="eyebrow"><MapPin size={12} /> Farmgate pickup</span><strong>{[o.pickupLocation.address.village, o.pickupLocation.address.district].filter(Boolean).join(", ") || "Farmer will share directions"}</strong></div>}
          {product && <Link to={`/product/${product._id}`} className="ghost-button" data-testid="order-product-link">View produce listing</Link>}
        </aside>
      </div>
    </div>
  );
}
