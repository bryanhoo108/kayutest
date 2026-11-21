import { useEffect, useRef, useState } from 'react';
import {
  Check, Clock, Ellipsis, Printer, Undo2, Ban, QrCode, Store, Wallet, CircleCheck, RotateCcw, ChefHat, BellRing, Coffee, ReceiptText,
} from 'lucide-react';
import { Empty } from '../components/ui.jsx';
import { elapsed, orderNo, rm, timeOf, PAYMENT_LABEL, changedOptions } from '../lib/format.js';
import { useNow } from '../lib/useLive.js';
import { useStaff } from './StaffApp.jsx';
import { useOrderActions } from './orderActions.jsx';

const COLUMNS = [
  { id: 'new', title: 'New', icon: BellRing, empty: 'No new orders' },
  { id: 'preparing', title: 'Preparing', icon: ChefHat, empty: 'Nothing on the bar' },
  { id: 'ready', title: 'Ready for pickup', short: 'Ready', icon: Coffee, empty: 'No drinks waiting' },
];

function Menu({ order, actions, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    setTimeout(() => document.addEventListener('pointerdown', close), 0);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [onClose]);
  const item = (label, Icon, fn, tone) => (
    <button type="button" role="menuitem" className={tone ? `is-${tone}` : ''} onClick={() => { onClose(); fn(order); }}>
      <Icon size={17} /> {label}
    </button>
  );
  return (
    <div className="pop-menu" role="menu" ref={ref}>
      {item('Print receipt', Printer, (o) => actions.print(o, 'receipt'))}
      {item('Print bar ticket', ReceiptText, (o) => actions.print(o, 'ticket'))}
      {order.status !== 'new' && item('Move back a step', Undo2, actions.back)}
      {order.paymentStatus === 'paid' && item('Void payment', RotateCcw, actions.voidPayment)}
      {item('Cancel order', Ban, actions.cancel, 'danger')}
    </div>
  );
}

function Ticket({ order, now, actions }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const since = order.status === 'ready' ? order.readyAt : order.createdAt;
  const mins = (now - since) / 60000;
  const age = order.status === 'ready' ? (mins >= 10 ? 'late' : '') : mins >= 10 ? 'late' : mins >= 5 ? 'warn' : '';
  const doneCount = order.items.filter((l) => l.done).length;

  const primary = {
    new: { label: 'Start making', fn: actions.start, tone: 'primary' },
    preparing: { label: 'Mark ready', fn: actions.ready, tone: 'success' },
    ready: { label: order.paymentStatus === 'paid' ? 'Collected' : 'Collect & pay', fn: actions.complete, tone: 'dark' },
  }[order.status];

  return (
    <article className={`ticket status-${order.status} ${age ? `age-${age}` : ''} ${order.status === 'new' ? 'is-fresh' : ''}`}>
      <header className="ticket-head">
        <div className="ticket-no">{orderNo(order.number)}</div>
        <div className="ticket-who">
          <strong>{order.customerName || 'Walk-in'}</strong>
          <span>
            {order.source === 'qr' ? <><QrCode size={13} /> QR order</> : <><Store size={13} /> Walk-up</>}
            <span className="dot-sep" />
            {order.itemCount} drink{order.itemCount === 1 ? '' : 's'}
          </span>
        </div>
        <div className={`ticket-timer ${age}`} title={`Placed ${timeOf(order.createdAt)}`}>
          <Clock size={14} /> {elapsed(now - since)}
        </div>
        <div className="ticket-more">
          <button type="button" className="icon-btn sm" aria-label="More actions" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
            <Ellipsis size={18} />
          </button>
          {menuOpen && <Menu order={order} actions={actions} onClose={() => setMenuOpen(false)} />}
        </div>
      </header>

      <ul className="ticket-lines">
        {order.items.map((l) => {
          const changed = changedOptions(l.options);
          const canTick = order.status === 'preparing';
          return (
            <li key={l.id} className={l.done ? 'is-done' : ''}>
              <button type="button" className="tick" disabled={!canTick} onClick={() => actions.toggleLine(order, l)}
                aria-label={l.done ? `Mark ${l.name} not done` : `Mark ${l.name} done`} aria-pressed={l.done}>
                {l.done ? <Check size={14} strokeWidth={3} /> : null}
              </button>
              <span className="tl-qty">{l.qty}×</span>
              <span className="tl-main">
                <span className="tl-name">{l.name}</span>
                {changed.length > 0 && (
                  <span className="tl-opts">{changed.map((o) => <em key={o.group}>{o.name}</em>)}</span>
                )}
                {l.note && <span className="tl-note">“{l.note}”</span>}
              </span>
            </li>
          );
        })}
      </ul>
      {order.note && <p className="ticket-note">📝 {order.note}</p>}

      <footer className="ticket-foot">
        {order.paymentStatus === 'paid' ? (
          <span className="pay-chip is-paid"><CircleCheck size={14} /> Paid · {PAYMENT_LABEL[order.paymentMethod]}</span>
        ) : (
          <button type="button" className="pay-chip is-unpaid" onClick={() => actions.pay(order)}>
            <Wallet size={14} /> Unpaid · {rm(order.total)}
          </button>
        )}
        {order.status === 'preparing' && order.items.length > 1 && (
          <span className="progress-text">{doneCount}/{order.items.length}</span>
        )}
      </footer>
      {primary && (
        <button type="button" className={`btn btn-${primary.tone} btn-block ticket-action`} onClick={() => primary.fn(order)}>
          {primary.label}
        </button>
      )}
    </article>
  );
}

export default function Board() {
  const { orders } = useStaff();
  const { actions, dialogs } = useOrderActions();
  const now = useNow(1000);
  const [tab, setTab] = useState('new');
  const [showDone, setShowDone] = useState(false);

  const by = (s) => orders.filter((o) => o.status === s);
  const recent = orders
    .filter((o) => (o.status === 'completed' || o.status === 'cancelled') && now - (o.completedAt || o.cancelledAt) < 3 * 3600_000)
    .sort((a, b) => (b.completedAt || b.cancelledAt) - (a.completedAt || a.cancelledAt));
  const active = orders.filter((o) => ['new', 'preparing', 'ready'].includes(o.status));
  const unpaid = active.filter((o) => o.paymentStatus !== 'paid');

  return (
    <div className="board-page">
      <div className="board-summary">
        <div className="pill-stat"><b>{active.length}</b> active</div>
        <div className="pill-stat"><b>{active.reduce((s, o) => s + o.itemCount, 0)}</b> drinks to go</div>
        {unpaid.length > 0 && <div className="pill-stat is-warn"><b>{unpaid.length}</b> unpaid · {rm(unpaid.reduce((s, o) => s + o.total, 0))}</div>}
        <button type="button" className={`chip-btn ${showDone ? 'is-active' : ''}`} onClick={() => setShowDone((v) => !v)}>
          <CircleCheck size={16} /> Recently done ({recent.length})
        </button>
      </div>

      <div className="board-tabs" role="tablist">
        {COLUMNS.map((c) => (
          <button key={c.id} type="button" role="tab" aria-selected={tab === c.id} className={tab === c.id ? 'is-active' : ''} onClick={() => setTab(c.id)}>
            {c.short || c.title} <b>{by(c.id).length}</b>
          </button>
        ))}
      </div>

      <div className="board">
        {COLUMNS.map((c) => {
          const list = by(c.id);
          return (
            <section key={c.id} className={`board-col col-${c.id} ${tab === c.id ? 'is-tab' : ''}`}>
              <h2><c.icon size={18} /> {c.title} <span className="count">{list.length}</span></h2>
              <div className="board-list">
                {list.length === 0 ? <Empty title={c.empty} /> : list.map((o) => <Ticket key={o.id} order={o} now={now} actions={actions} />)}
              </div>
            </section>
          );
        })}
      </div>

      {showDone && (
        <section className="done-drawer">
          <h2>Recently done <span className="muted small">(last 3 hours)</span></h2>
          {recent.length === 0 ? <p className="muted">Nothing yet.</p> : (
            <ul>
              {recent.map((o) => (
                <li key={o.id} className={`status-${o.status}`}>
                  <span className="dd-no">{orderNo(o.number)}</span>
                  <span className="dd-who">{o.customerName || 'Walk-in'} · {o.itemCount} drink{o.itemCount === 1 ? '' : 's'} · {rm(o.total)}</span>
                  <span className={`badge badge-${o.status}`}>{o.status === 'completed' ? 'Collected' : 'Cancelled'}</span>
                  {o.status === 'completed' && o.paymentStatus !== 'paid' && <button type="button" className="pay-chip is-unpaid" onClick={() => actions.pay(o)}>Unpaid</button>}
                  {o.status === 'completed' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => actions.recall(o)}><Undo2 size={15} /> Recall</button>}
                  <button type="button" className="icon-btn sm" aria-label="Print receipt" onClick={() => actions.print(o)}><Printer size={16} /></button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {dialogs}
    </div>
  );
}
