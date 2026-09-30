import { Link, useParams } from "react-router-dom";
import { ArrowLeft, MapPin, ShieldCheck, Sprout } from "lucide-react";
import { useFarmer } from "@/hooks/queries";
import { money, qty } from "@/lib/constants";
import { EmptyState, ErrorState, LoadingState, PageHeading } from "@/components/common/States";

export default function FarmerProfilePage() {
  const { id } = useParams();
  const q = useFarmer(id);
  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState error={q.error} onRetry={q.refetch} />;
  const { farmer, products } = q.data;
  return (
    <div className="resource-page" data-testid="farmer-profile-page">
      <Link to="/" className="back-link" data-testid="farmer-back-link"><ArrowLeft size={16} /> Back to market</Link>
      <PageHeading eyebrow="Farmer" title={farmer.farmDetails?.farmName || farmer.name} />
      <div className="data-card">
        <div className="data-card-head"><div><h3><Sprout size={16} /> {farmer.name}</h3><span className="sub"><MapPin size={12} /> {[farmer.farmDetails?.address?.village, farmer.farmDetails?.address?.district].filter(Boolean).join(", ") || "Tamil Nadu"} · approximate location shown for privacy</span></div>{farmer.isVerified && <span className="verified"><ShieldCheck size={14} /> Verified</span>}</div>
        {farmer.farmDetails?.bio && <p className="muted">{farmer.farmDetails.bio}</p>}
      </div>
      <h3 className="section-title">Available produce</h3>
      {products.length === 0 ? <EmptyState title="No active listings" text="This farmer has nothing listed right now." /> : (
        <div className="card-list" data-testid="farmer-products-list">{products.map((p) => <Link key={p._id} to={`/product/${p._id}`} className="data-card" data-testid={`farmer-product-${p._id}`}><div className="data-card-head"><div><h3>{p.name}</h3><span className="sub">{p.category} · {qty(p.availableStock, p.unit)} available</span></div><strong>{money(p.pricePerUnit)}/{String(p.unit).toLowerCase()}</strong></div></Link>)}</div>
      )}
    </div>
  );
}
