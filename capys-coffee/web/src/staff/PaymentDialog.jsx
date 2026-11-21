import { useEffect, useMemo, useState } from 'react';
import { Banknote, CreditCard, QrCode } from 'lucide-react';
import { Sheet, SheetHeader, Spinner } from '../components/ui.jsx';
import { rm, rmShort } from '../lib/format.js';

const METHODS = [
  { id: 'cash', label: 'Cash', icon: Banknote },
  { id: 'qr', label: 'DuitNow QR', icon: QrCode },
  { id: 'card', label: 'Card', icon: CreditCard },
];

/** Quick-tender amounts (sen) that make sense for a total: exact, then the next round notes. */
function tenderOptions(total) {
  const notes = [500, 1000, 2000, 5000, 10000];
  const opts = new Set([total]);
  for (const n of notes) {
    const v = Math.ceil(total / n) * n;
    if (v > total) opts.add(v);
  }
  return [...opts].sort((a, b) => a - b).slice(0, 5);
}

/**
 * Take payment. `onPay({ method, cashReceived })` must return a promise.
 * `extraAction` renders a secondary button (e.g. "Pay later").
 */
export default function PaymentDialog({ open, onClose, total, title = 'Take payment', subtitle, confirmLabel = 'Confirm payment', onPay, extraAction }) {
  const [method, setMethod] = useState('cash');
  const [cash, setCash] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setMethod('cash'); setCash(''); setBusy(false); }
  }, [open]);

  const cashSen = cash === '' ? null : Math.round(Number(cash) * 100);
  const cashValid = cashSen == null || (Number.isFinite(cashSen) && cashSen >= total);
  const change = cashSen != null && Number.isFinite(cashSen) ? cashSen - total : null;
  const quick = useMemo(() => tenderOptions(total), [total]);

  const submit = async () => {
    if (method === 'cash' && !cashValid) return;
    setBusy(true);
    try {
      await onPay({ method, cashReceived: method === 'cash' && cashSen != null ? cashSen : null });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} label={title} size="sm">
      <SheetHeader title={title} subtitle={subtitle} onClose={onClose} />
      <div className="sheet-body pay-body">
        <div className="pay-total"><span>Amount due</span><strong>{rm(total)}</strong></div>
        <div className="method-grid" role="radiogroup" aria-label="Payment method">
          {METHODS.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={method === m.id}
              className={`method ${method === m.id ? 'is-active' : ''}`} onClick={() => setMethod(m.id)}>
              <m.icon size={24} />
              <span>{m.label}</span>
            </button>
          ))}
        </div>
        {method === 'cash' && (
          <div className="cash-box">
            <span className="field-label">Cash received</span>
            <div className="quick-tender">
              {quick.map((v) => (
                <button key={v} type="button" className={cashSen === v ? 'is-active' : ''} onClick={() => setCash((v / 100).toFixed(2))}>
                  {v === total ? 'Exact' : rmShort(v)}
                </button>
              ))}
            </div>
            <div className="money-input">
              <span>RM</span>
              <input type="number" inputMode="decimal" min="0" step="0.10" placeholder={(total / 100).toFixed(2)}
                value={cash} onChange={(e) => setCash(e.target.value)} aria-label="Cash received in ringgit" />
            </div>
            {change != null && (
              cashValid
                ? <div className="change-due"><span>Change</span><strong>{rm(change)}</strong></div>
                : <div className="field-error">Cash is less than the amount due</div>
            )}
          </div>
        )}
        {method === 'qr' && <p className="muted pay-hint">Ask the customer to scan your DuitNow QR and confirm the payment notification before continuing.</p>}
        {method === 'card' && <p className="muted pay-hint">Charge {rm(total)} on the card terminal, then confirm here once it’s approved.</p>}
      </div>
      <div className={`sheet-footer ${extraAction ? 'two' : ''}`}>
        {extraAction}
        <button type="button" className="btn btn-success btn-lg grow" onClick={submit} disabled={busy || (method === 'cash' && !cashValid)}>
          {busy ? <Spinner /> : confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}
