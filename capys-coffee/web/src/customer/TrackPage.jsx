import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, ChevronLeft, CircleAlert, Coffee, PartyPopper, Receipt, Wallet, CircleCheck } from 'lucide-react';
import { Logo, Spinner } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { orderNo, rm, PAYMENT_LABEL } from '../lib/format.js';
import { chimeReady, unlockAudio } from '../lib/sound.js';
import { useShop } from './store.jsx';
import { ShopHeader } from './MenuPage.jsx';

const STEPS = ['new', 'preparing', 'ready', 'completed'];

export default function TrackPage() {
  const { token } = useParams();
  const { t, orderUpdates, rememberOrder, live, lang } = useShop();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const prevStatus = useRef(null);

  const fetchOrder = () => api.get(`/api/orders/${token}`).then((o) => { setOrder(o); rememberOrder(o); setError(null); }).catch((e) => setError(e));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchOrder(); }, [token]);

  // Live updates arrive through the shared stream in ShopProvider.
  const update = orderUpdates[token];
  useEffect(() => {
    if (update && (!order || update.updatedAt >= order.updatedAt)) setOrder(update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [update]);

  // Safety net: refresh every 30 s while the order is still in progress.
  useEffect(() => {
    if (!order || ['completed', 'cancelled'].includes(order.status)) return undefined;
    const iv = setInterval(fetchOrder, 30000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.status, token]);

  // Re-sync when the connection comes back.
  useEffect(() => {
    if (live === 'live' && order) fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  useEffect(() => {
    if (!order) return;
    if (prevStatus.current && prevStatus.current !== 'ready' && order.status === 'ready') {
      chimeReady();
      if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
    }
    prevStatus.current = order.status;
    document.title = order.status === 'ready' ? `✅ ${orderNo(order.number)} is ready — Capy's Coffee` : `${orderNo(order.number)} · Capy's Coffee`;
    return () => { document.title = "Capy's Coffee"; };
  }, [order?.status, order?.number]); // eslint-disable-line react-hooks/exhaustive-deps

  const back = (
    <Link to="/" className="back-btn"><ChevronLeft size={22} /> <span>{t.orderMore}</span></Link>
  );

  if (error) {
    return (
      <div className="shop">
        <ShopHeader back={back} />
        <main className="shop-main narrow">
          <div className="page-center">
            <CircleAlert size={40} />
            <h2>{error.status === 404 ? 'Order not found' : 'Can’t load your order'}</h2>
            <p className="muted">{error.message}</p>
            <button type="button" className="btn btn-primary" onClick={fetchOrder}>Try again</button>
          </div>
        </main>
      </div>
    );
  }
  if (!order) return <div className="page-center"><Spinner size={28} /></div>;

  const cancelled = order.status === 'cancelled';
  const stepIndex = STEPS.indexOf(order.status);
  const label = {
    new: [t.received, t.receivedSub], preparing: [t.preparing, t.preparingSub], ready: [t.ready, t.readySub],
    completed: [t.collected, t.collectedSub], cancelled: [t.cancelled, t.cancelledSub],
  }[order.status];
  const n = (o) => (lang === 'zh' && o.nameZh) || o.name;

  return (
    <div className="shop">
      <ShopHeader back={back} />
      <main className="shop-main narrow track">
        <section className={`track-hero status-${order.status}`}>
          <div className="track-live">
            <span className={`live-dot ${live === 'live' ? 'is-live' : ''}`} /> {live === 'live' ? t.live : t.reconnecting}
          </div>
          <div className="track-icon">
            {order.status === 'ready' ? <PartyPopper size={34} /> : cancelled ? <CircleAlert size={34} /> : order.status === 'completed' ? <CircleCheck size={34} /> : <Coffee size={34} className={order.status === 'preparing' ? 'steam' : ''} />}
          </div>
          <p className="track-label">{t.orderNumber}</p>
          <div className="track-number">{orderNo(order.number)}</div>
          <h1>{label[0]}</h1>
          <p className="track-sub">{order.status === 'cancelled' && order.cancelReason ? order.cancelReason : label[1]}</p>
          {(order.status === 'new' || order.status === 'preparing') && <p className="track-hint">{t.notifyReady}</p>}
        </section>

        {!cancelled && (
          <ol className="steps" aria-label="Order progress">
            {STEPS.map((s, i) => (
              <li key={s} className={i < stepIndex ? 'is-done' : i === stepIndex ? 'is-current' : ''}>
                <span className="step-dot">{i < stepIndex || (i === stepIndex && s === 'completed') ? <Check size={14} strokeWidth={3} /> : i + 1}</span>
                <span className="step-label">{{ new: t.received, preparing: t.preparing, ready: t.ready.replace('!', ''), completed: t.collected }[s]}</span>
              </li>
            ))}
          </ol>
        )}

        {!cancelled && (
          order.paymentStatus === 'paid' ? (
            <div className="pay-status is-paid"><CircleCheck size={20} /> {t.paid} · {PAYMENT_LABEL[order.paymentMethod] || ''} · {rm(order.total)}</div>
          ) : (
            <div className="pay-status is-unpaid"><Wallet size={20} /> <span><strong>{t.payNow(rm(order.total))}</strong><br /><span className="small">{t.showNumber}</span></span></div>
          )
        )}

        <section className="card">
          <div className="card-head">
            <h2><Receipt size={18} /> {t.yourOrder}</h2>
            <span className="muted small">
              {order.customerName}
            </span>
          </div>
          <ul className="receipt-lines">
            {order.items.map((l, i) => (
              <li key={i}>
                <span className="rl-qty">{l.qty}×</span>
                <span className="rl-main">
                  <span className="rl-name">{n(l)}</span>
                  <span className="rl-opts">{l.options.map((o) => n(o)).join(' · ')}</span>
                  {l.note && <span className="rl-note">“{l.note}”</span>}
                </span>
                <span className="rl-price">{rm(l.lineTotal)}</span>
              </li>
            ))}
          </ul>
          {order.note && <p className="order-note">“{order.note}”</p>}
          <div className="summary-row total"><span>{t.total}</span><span>{rm(order.total)}</span></div>
        </section>

        <div className="center track-footer">
          <Link to="/" className="btn btn-ghost">{t.orderMore}</Link>
          <div className="track-brand"><Logo size={40} /><span className="muted small">{t.everySip}</span></div>
        </div>
      </main>
    </div>
  );
}
