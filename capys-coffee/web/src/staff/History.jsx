import { useCallback, useEffect, useState } from 'react';
import { Search, Printer, Wallet, Ban, Undo2, RotateCcw, Download, QrCode, Store } from 'lucide-react';
import { Empty, Sheet, SheetHeader, Spinner } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { dateTimeOf, orderNo, rm, timeOf, ymd, duration, PAYMENT_LABEL, STATUS_LABEL } from '../lib/format.js';
import { useStaff } from './StaffApp.jsx';
import { useOrderActions } from './orderActions.jsx';

const STATUS_FILTERS = [
  { id: 'all', label: 'All' }, { id: 'unpaid', label: 'Unpaid' }, { id: 'completed', label: 'Collected' },
  { id: 'preparing', label: 'In progress' }, { id: 'cancelled', label: 'Cancelled' },
];

export function DateRange({ from, to, onChange, tz }) {
  const presets = [
    { label: 'Today', f: ymd(tz), t: ymd(tz) },
    { label: 'Yesterday', f: ymd(tz, -1), t: ymd(tz, -1) },
    { label: '7 days', f: ymd(tz, -6), t: ymd(tz) },
    { label: '30 days', f: ymd(tz, -29), t: ymd(tz) },
  ];
  return (
    <div className="date-range">
      <div className="preset-chips">
        {presets.map((p) => (
          <button key={p.label} type="button" className={from === p.f && to === p.t ? 'is-active' : ''} onClick={() => onChange(p.f, p.t)}>{p.label}</button>
        ))}
      </div>
      <div className="date-inputs">
        <input type="date" className="input" value={from} max={to} onChange={(e) => e.target.value && onChange(e.target.value, to < e.target.value ? e.target.value : to)} aria-label="From date" />
        <span className="muted">to</span>
        <input type="date" className="input" value={to} min={from} onChange={(e) => e.target.value && onChange(from > e.target.value ? e.target.value : from, e.target.value)} aria-label="To date" />
      </div>
    </div>
  );
}

function OrderDetail({ order, onClose, actions, tz }) {
  if (!order) return <Sheet open={false} onClose={onClose} />;
  const timeline = [
    ['Placed', order.createdAt], ['Accepted', order.acceptedAt], ['Ready', order.readyAt],
    ['Collected', order.completedAt], ['Paid', order.paidAt], ['Cancelled', order.cancelledAt],
  ].filter(([, t]) => t).sort((a, b) => a[1] - b[1]);
  return (
    <Sheet open={!!order} onClose={onClose} label={`Order ${orderNo(order.number)}`} size="md">
      <SheetHeader title={`Order ${orderNo(order.number)}`} subtitle={`${dateTimeOf(order.createdAt, tz)} · ${order.source === 'qr' ? 'QR order' : 'Walk-up'}`} onClose={onClose} />
      <div className="sheet-body detail">
        <div className="detail-badges">
          <span className={`badge badge-${order.status}`}>{STATUS_LABEL[order.status]}</span>
          <span className={`badge badge-pay-${order.paymentStatus}`}>
            {order.paymentStatus === 'paid' ? `Paid · ${PAYMENT_LABEL[order.paymentMethod]}` : order.paymentStatus === 'refunded' ? 'Refunded' : 'Unpaid'}
          </span>
        </div>
        <dl className="detail-grid">
          <div><dt>Customer</dt><dd>{order.customerName || '—'}</dd></div>
          <div><dt>Total</dt><dd>{rm(order.total)}</dd></div>
          {order.cashReceived != null && <div><dt>Cash / change</dt><dd>{rm(order.cashReceived)} / {rm(order.cashReceived - order.total)}</dd></div>}
          {order.readyAt && <div><dt>Prep time</dt><dd>{duration(order.readyAt - order.createdAt)}</dd></div>}
        </dl>
        <ul className="receipt-lines">
          {order.items.map((l) => (
            <li key={l.id}>
              <span className="rl-qty">{l.qty}×</span>
              <span className="rl-main">
                <span className="rl-name">{l.name}</span>
                <span className="rl-opts">{l.options.map((o) => o.name).join(' · ')}</span>
                {l.note && <span className="rl-note">“{l.note}”</span>}
              </span>
              <span className="rl-price">{rm(l.lineTotal)}</span>
            </li>
          ))}
        </ul>
        {order.note && <p className="order-note">“{order.note}”</p>}
        {order.cancelReason && <p className="order-note is-danger">Cancelled: {order.cancelReason}</p>}
        <h3 className="detail-sub">Timeline</h3>
        <ol className="timeline">
          {timeline.map(([label, t]) => <li key={label}><span>{label}</span><span className="muted">{timeOf(t, tz)}</span></li>)}
        </ol>
      </div>
      <div className="sheet-footer wrap">
        <button type="button" className="btn btn-ghost" onClick={() => actions.print(order)}><Printer size={17} /> Receipt</button>
        {order.paymentStatus === 'unpaid' && order.status !== 'cancelled' && <button type="button" className="btn btn-success" onClick={() => actions.pay(order)}><Wallet size={17} /> Take payment</button>}
        {order.paymentStatus === 'paid' && <button type="button" className="btn btn-ghost" onClick={() => actions.voidPayment(order)}><RotateCcw size={17} /> Void payment</button>}
        {order.status === 'completed' && <button type="button" className="btn btn-ghost" onClick={() => actions.recall(order)}><Undo2 size={17} /> Recall</button>}
        {order.status !== 'cancelled' && order.status !== 'completed' && <button type="button" className="btn btn-danger-ghost" onClick={() => actions.cancel(order)}><Ban size={17} /> Cancel</button>}
      </div>
    </Sheet>
  );
}

export default function History() {
  const { menu, orders: live, handleError } = useStaff();
  const tz = menu?.store.timeZone;
  const { actions, dialogs } = useOrderActions();
  const [from, setFrom] = useState(() => ymd(tz));
  const [to, setTo] = useState(() => ymd(tz));
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(() => {
    const p = new URLSearchParams({ from, to, status });
    if (q.trim()) p.set('q', q.trim());
    api.get(`/api/staff/orders?${p}`).then((r) => setRows(r.orders)).catch(handleError);
  }, [from, to, status, q, handleError]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  // Merge live updates into the visible rows so the list never goes stale.
  const merged = (rows || []).map((r) => {
    const l = live.find((o) => o.id === r.id);
    return l && l.updatedAt > r.updatedAt ? l : r;
  });
  const selected = selectedId ? merged.find((o) => o.id === selectedId) || live.find((o) => o.id === selectedId) || null : null;

  const valid = merged.filter((o) => o.status !== 'cancelled');
  const sum = valid.reduce((s, o) => s + o.total, 0);

  return (
    <div className="page history">
      <div className="toolbar">
        <DateRange from={from} to={to} tz={tz} onChange={(f, t) => { setFrom(f); setTo(t); }} />
        <div className="toolbar-right">
          <label className="search">
            <Search size={17} />
            <input placeholder="Order # or name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search orders" />
          </label>
          <a className="btn btn-ghost" href={`/api/staff/export.csv?from=${from}&to=${to}`}><Download size={17} /> CSV</a>
        </div>
      </div>
      <div className="preset-chips status-chips">
        {STATUS_FILTERS.map((s) => (
          <button key={s.id} type="button" className={status === s.id ? 'is-active' : ''} onClick={() => setStatus(s.id)}>{s.label}</button>
        ))}
        {rows && <span className="muted small chips-meta">{merged.length} order{merged.length === 1 ? '' : 's'} · {rm(sum)} excl. cancelled</span>}
      </div>

      {!rows ? <div className="page-center"><Spinner size={26} /></div> : merged.length === 0 ? (
        <Empty title="No orders found">Try another date range or filter.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Order</th><th>Time</th><th>Customer</th><th className="hide-sm">Items</th><th>Total</th><th>Status</th><th>Payment</th></tr>
            </thead>
            <tbody>
              {merged.map((o) => (
                <tr key={o.id} onClick={() => setSelectedId(o.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setSelectedId(o.id)}>
                  <td><strong>{orderNo(o.number)}</strong> <span className="src-icon" title={o.source === 'qr' ? 'QR order' : 'Walk-up'}>{o.source === 'qr' ? <QrCode size={13} /> : <Store size={13} />}</span></td>
                  <td className="nowrap">{from !== to && <span className="muted small">{o.businessDate.slice(5)} </span>}{timeOf(o.createdAt, tz)}</td>
                  <td>{o.customerName || <span className="muted">Walk-in</span>}</td>
                  <td className="hide-sm items-cell">{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</td>
                  <td className="nowrap"><strong>{rm(o.total)}</strong></td>
                  <td><span className={`badge badge-${o.status}`}>{STATUS_LABEL[o.status]}</span></td>
                  <td><span className={`badge badge-pay-${o.paymentStatus}`}>{o.paymentStatus === 'paid' ? PAYMENT_LABEL[o.paymentMethod] : o.paymentStatus === 'refunded' ? 'Refunded' : 'Unpaid'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <OrderDetail order={selected} onClose={() => setSelectedId(null)} actions={actions} tz={tz} />
      {dialogs}
    </div>
  );
}
