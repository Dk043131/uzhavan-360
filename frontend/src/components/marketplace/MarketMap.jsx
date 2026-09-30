import { useEffect } from "react";
import { Link } from "react-router-dom";
import { MapContainer, Marker, Popup, TileLayer, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { money } from "@/lib/constants";

const icon = L.divIcon({ className: "", html: '<div style="width:16px;height:16px;border-radius:50%;background:#166534;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });

function Recenter({ center }) { const map = useMap(); useEffect(() => { map.setView(center, map.getZoom()); }, [center, map]); return null; }

// Uses backend-provided fuzzedLocation (privacy jitter) — exact farm coordinates are never shown.
export function MarketMap({ items, center, radiusKm }) {
  const c = [center.lat, center.lng];
  return (
    <div className="map-wrap" data-testid="marketplace-map">
      <MapContainer center={c} zoom={11} scrollWheelZoom={false}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Recenter center={c} />
        <Circle center={c} radius={radiusKm * 1000} pathOptions={{ color: "#166534", weight: 1, fillOpacity: 0.04 }} />
        {items.filter((i) => i.fuzzedLocation).map((item) => (
          <Marker key={item._id} position={[item.fuzzedLocation.lat, item.fuzzedLocation.lng]} icon={icon}>
            <Popup><div className="map-popup"><strong>{item.name}</strong>{money(item.pricePerUnit)}/{String(item.unit).toLowerCase()} · {item.availableStock} {String(item.unit).toLowerCase()} · ~{item.distanceKm} km<br /><Link to={`/product/${item._id}`} data-testid={`map-popup-link-${item._id}`}>View produce</Link></div></Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
