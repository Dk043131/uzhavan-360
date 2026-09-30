import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, MapPin, ShieldCheck, Sprout } from "lucide-react";
import { cropName, imageFor, money } from "@/lib/constants";

export function ProductCard({ product }) {
  const sellSoon = product.freshnessTier === "SELL_SOON";
  const out = product.availabilityStatus === "OUT_OF_STOCK" || product.availableStock <= 0;
  return (
    <motion.article whileHover={{ y: -4 }} className="product-card" data-testid={`product-card-${product._id}`}>
      <Link to={`/product/${product._id}`} data-testid={`product-card-link-${product._id}`}>
        <div className="product-image">
          <img src={imageFor(product)} alt={product.name} loading="lazy" />
          {sellSoon && <span className="freshness-chip urgent">Sell soon</span>}
          {product.availabilityStatus === "LOW_STOCK" && <span className="stock-chip">Only {product.availableStock} {String(product.unit).toLowerCase()} left</span>}
          {out && <span className="stock-chip">Sold out</span>}
        </div>
        <div className="product-card-body">
          <div className="product-title"><div><h3>{product.name}</h3><span className="tamil-name">{cropName(product.name)}</span></div><span className="price">{money(product.pricePerUnit)}<small>/{String(product.unit || "kg").toLowerCase()}</small></span></div>
          <div className="product-meta"><span><Sprout size={14} />{product.farmer?.farmName || product.farmer?.name || "Local farmer"}</span>{product.farmer?.isVerified && <span className="verified"><ShieldCheck size={14} /> Verified</span>}</div>
          <div className="product-footer"><span><MapPin size={13} />{typeof product.distanceKm === "number" ? `${product.distanceKm} km` : "Nearby"} · {product.address?.village}</span><span className="request-link">View <ChevronRight size={14} /></span></div>
        </div>
      </Link>
    </motion.article>
  );
}
