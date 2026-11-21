import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Minus, Plus, X, CircleCheck, CircleAlert, Info } from 'lucide-react';

export function Logo({ size = 44, className = '' }) {
  return <img src="/logo.svg" width={size} height={size} alt="Capy's Coffee" className={`logo ${className}`} draggable="false" />;
}

/* ---------------- Sheet / dialog ---------------- */

let openSheets = 0;

/**
 * Bottom sheet on phones, centred dialog on larger screens.
 * Closes on Escape and backdrop tap; restores focus when closed.
 */
export function Sheet({ open, onClose, children, label, size = 'md', className = '' }) {
  const panel = useRef(null);
  const [render, setRender] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setRender(true);
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(r);
    }
    setShown(false);
    const t = setTimeout(() => setRender(false), 220);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!render) return undefined;
    const prev = document.activeElement;
    openSheets++;
    document.body.classList.add('no-scroll');
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); }
      if (e.key === 'Tab' && panel.current) {
        const f = panel.current.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    setTimeout(() => panel.current?.focus({ preventScroll: true }), 30);
    return () => {
      openSheets--;
      if (!openSheets) document.body.classList.remove('no-scroll');
      document.removeEventListener('keydown', onKey);
      if (prev && prev.focus) prev.focus({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [render]);

  if (!render) return null;
  return createPortal(
    <div className={`sheet-root ${shown ? 'is-open' : ''}`}>
      <div className="sheet-backdrop" onClick={onClose} />
      <div ref={panel} className={`sheet sheet-${size} ${className}`} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function SheetHeader({ title, subtitle, onClose }) {
  return (
    <div className="sheet-header">
      <div>
        <h2>{title}</h2>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {onClose && (
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
      )}
    </div>
  );
}

/* ---------------- Confirm dialog ---------------- */

export function Confirm({ open, title, body, confirmLabel = 'Confirm', tone = 'primary', onConfirm, onClose, children, busy }) {
  return (
    <Sheet open={open} onClose={onClose} label={title} size="sm">
      <SheetHeader title={title} onClose={onClose} />
      <div className="sheet-body">
        {body && <p className="muted">{body}</p>}
        {children}
      </div>
      <div className="sheet-footer two">
        <button type="button" className="btn btn-ghost" onClick={onClose}>Back</button>
        <button type="button" className={`btn btn-${tone}`} onClick={onConfirm} disabled={busy}>{busy ? <Spinner /> : confirmLabel}</button>
      </div>
    </Sheet>
  );
}

/* ---------------- Toasts ---------------- */

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, tone = 'success', ms = 3200) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t.slice(-2), { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ms);
  }, []);
  const Icon = { success: CircleCheck, error: CircleAlert, info: Info };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      {createPortal(
        <div className="toasts" role="status" aria-live="polite">
          {toasts.map((t) => {
            const I = Icon[t.tone] || Info;
            return (
              <div key={t.id} className={`toast toast-${t.tone}`}>
                <I size={18} /> <span>{t.message}</span>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  );
}

/* ---------------- Controls ---------------- */

export function Stepper({ value, onChange, min = 1, max = 50, size = 'md', label = 'Quantity' }) {
  return (
    <div className={`stepper stepper-${size}`} role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Decrease">
        <Minus size={size === 'sm' ? 14 : 18} />
      </button>
      <span aria-live="polite">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Increase">
        <Plus size={size === 'sm' ? 14 : 18} />
      </button>
    </div>
  );
}

export function Segmented({ value, onChange, options, size = 'md', label }) {
  return (
    <div className={`segmented segmented-${size}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'is-active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.icon}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`switch ${checked ? 'is-on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

export function Spinner({ size = 18 }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-label="Loading" />;
}

export function Empty({ icon, title, children }) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon">{icon}</div>}
      <h3>{title}</h3>
      {children && <p className="muted">{children}</p>}
    </div>
  );
}
