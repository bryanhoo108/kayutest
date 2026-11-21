export const rm = (sen) => `RM ${(Number(sen || 0) / 100).toFixed(2)}`;
export const rmShort = (sen) => {
  const v = Number(sen || 0) / 100;
  return `RM ${Number.isInteger(v) ? v : v.toFixed(2)}`;
};
export const orderNo = (n) => `#${String(n).padStart(3, '0')}`;

export function elapsed(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  if (m >= 60) return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function duration(ms) {
  if (ms == null) return '—';
  const m = Math.round(ms / 60000);
  if (m < 1) return '< 1 min';
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function timeOf(ms, timeZone) {
  return new Date(ms).toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit', timeZone });
}
export function dateTimeOf(ms, timeZone) {
  return new Date(ms).toLocaleString('en-MY', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone });
}

/** 'YYYY-MM-DD' in the store's time zone, `offsetDays` from today. */
export function ymd(timeZone, offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
export function prettyDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export const PAYMENT_LABEL = { cash: 'Cash', qr: 'DuitNow QR', card: 'Card' };
export const STATUS_LABEL = { new: 'New', preparing: 'Preparing', ready: 'Ready', completed: 'Collected', cancelled: 'Cancelled' };
export const TYPE_LABEL = { dine_in: 'Dine-in', takeaway: 'Takeaway' };

/** Options that differ from the default — the only ones a barista needs to see highlighted. */
export const changedOptions = (options = []) => options.filter((o) => !o.isDefault);
