import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { InlineError } from "./States";

export function Modal({ open, onClose, title, eyebrow, children, testId = "modal", wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    ref.current?.querySelector("input,select,textarea,button")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="overlay" data-testid={testId} onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <motion.div ref={ref} role="dialog" aria-modal="true" aria-label={title} initial={{ y: 25, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={`modal ${wide ? "modal-wide" : ""}`}>
        <div className="modal-head"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div><button type="button" onClick={onClose} className="close-button" aria-label="Close" data-testid={`${testId}-close`}><X /></button></div>
        {children}
      </motion.div>
    </div>
  );
}

// Confirmation dialog for sensitive/destructive actions. The mutation runs only after the user confirms.
export function ConfirmDialog({ open, onClose, title, message, confirmLabel = "Confirm", danger = false, onConfirm, pending, error, children, testId = "confirm-dialog" }) {
  return (
    <Modal open={open} onClose={pending ? undefined : onClose} title={title} eyebrow="Please confirm" testId={testId}>
      {message && <p className="muted">{message}</p>}
      {children}
      <InlineError error={error} testId={`${testId}-error`} />
      <div className="dialog-actions">
        <button type="button" className="outline-button" onClick={onClose} disabled={pending} data-testid={`${testId}-cancel`}>Keep as is</button>
        <button type="button" className={danger ? "danger-button" : "primary-button"} onClick={onConfirm} disabled={pending} data-testid={`${testId}-confirm`}>{pending ? "Working..." : confirmLabel}</button>
      </div>
    </Modal>
  );
}

export function useDialog() {
  const [state, setState] = useState(null);
  return { state, open: (payload = true) => setState(payload), close: () => setState(null), isOpen: state !== null };
}
