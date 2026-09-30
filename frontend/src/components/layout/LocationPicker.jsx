import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, MapPin, X } from "lucide-react";

export function LocationPicker({ open, onClose, cities, onChoose, onUseDevice }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open) return null;
  const useDevice = async () => { setBusy(true); setError(""); try { await onUseDevice(); onClose(); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  return (
    <div className="overlay" data-testid="location-picker-modal">
      <motion.div role="dialog" aria-modal="true" aria-label="Choose your location" initial={{ y: 25, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="modal location-modal">
        <div className="modal-head"><div><span className="eyebrow">Fresh around you</span><h2>Where are you buying from?</h2></div><button onClick={onClose} className="close-button" aria-label="Close" data-testid="close-location-button"><X /></button></div>
        <p className="muted">Choose your city to discover produce from nearby farmers.</p>
        <div className="place-grid">
          {cities.map((c) => <button key={c.name} onClick={() => { onChoose(c); onClose(); }} className="place-option" data-testid={`location-${c.name.toLowerCase()}-option`}><MapPin size={17} /><span>{c.name}</span><ChevronRight size={15} /></button>)}
        </div>
        {error && <div className="error-box" role="alert" data-testid="location-error">{error}</div>}
        <button className="outline-button full-width" disabled={busy} onClick={useDevice} data-testid="use-current-location-button"><MapPin size={16} /> {busy ? "Locating..." : "Use my current location"}</button>
      </motion.div>
    </div>
  );
}
