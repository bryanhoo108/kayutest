import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ShoppingBag, Wallet, TriangleAlert, Pencil } from 'lucide-react';
import DrinkArt from '../components/DrinkArt.jsx';
import { Empty, Spinner, Stepper, useToast } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { rm } from '../lib/format.js';
import { useShop } from './store.jsx';
import { ShopHeader } from './MenuPage.jsx';
import ItemSheet from './ItemSheet.jsx';

export default function CheckoutPage() {
  const { menu, t, name, lang, cart, total, count, unavailable, updateLine, removeLine, clearCart, ctx, setCtx, rememberOrder, retry } = useShop();
  const navigate = useNavigate();
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');

  const groups = menu?.optionGroups || [];
  const optionText = (line) => groups
    .filter((g) => line.item.options.includes(g.id))
    .map((g) => {
      const c = g.choices.find((x) => x.id === (line.options?.[g.id] ?? g.default));
      return c ? name(c) : null;
    })
    .filter(Boolean)
    .join(' · ');

  const back = (
    <button type="button" className="back-btn" onClick={() => navigate('/')}>
      <ChevronLeft size={22} /> <span>{t.yourOrder}</span>
    </button>
  );

  if (!menu) return <div className="page-center"><Spinner size={28} /></div>;

  if (!cart.length) {
    return (
      <div className="shop">
        <ShopHeader back={back} />
        <main className="shop-main narrow">
          <Empty icon={<ShoppingBag size={32} />} title={t.emptyCart}>{t.emptyCartSub}</Empty>
          <div className="center"><Link to="/" className="btn btn-primary">{t.browseMenu}</Link></div>
        </main>
      </div>
    );
  }

  const placeOrder = async () => {
    setServerError('');
    const e = {};
    if (!ctx.name?.trim()) e.name = t.nameRequired;
    setErrors(e);
    if (Object.keys(e).length) {
      document.querySelector(`[name="${Object.keys(e)[0]}"]`)?.focus();
      return;
    }
    setBusy(true);
    try {
      const order = await api.post('/api/orders', {
        type: 'takeaway',
        customerName: ctx.name.trim(),
        note: note.trim(),
        items: cart.map((l) => ({ itemId: l.itemId, qty: l.qty, options: l.options, note: l.note })),
      });
      rememberOrder(order);
      clearCart();
      navigate(`/order/${order.token}`, { replace: true });
    } catch (err) {
      setServerError(err.message);
      if (err.status === 409) retry();
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="shop">
      <ShopHeader back={back} />
      <main className="shop-main narrow checkout">
        {!menu.store.open && <div className="closed-banner"><TriangleAlert size={18} /> {t.closedBanner}</div>}

        <section className="card">
          <div className="card-head">
            <h2>{t.yourOrder}</h2>
            <span className="muted">{t.items(count)}</span>
          </div>
          <ul className="cart-lines">
            {cart.map((l) => (
              <li key={l.key} className={l.item.available ? '' : 'is-soldout'}>
                <div className="cl-art" style={{ background: l.item.art.tint }}><DrinkArt art={l.item.art} size={44} /></div>
                <div className="cl-main">
                  <div className="cl-name">{name(l.item)}</div>
                  <div className="cl-opts">{optionText(l)}</div>
                  {l.note && <div className="cl-note">“{l.note}”</div>}
                  {!l.item.available && <div className="cl-warn">{t.soldOut} — {t.remove.toLowerCase()}</div>}
                  <button type="button" className="link-btn" onClick={() => setEditing(l)}><Pencil size={13} /> {t.edit}</button>
                </div>
                <div className="cl-side">
                  <span className="cl-price">{rm(l.item.price * l.qty)}</span>
                  <Stepper size="sm" value={l.qty} min={0} onChange={(q) => (q === 0 ? removeLine(l.key) : updateLine(l.key, { qty: q }))} />
                </div>
              </li>
            ))}
          </ul>
          <Link to="/" className="add-more">+ {t.orderMore}</Link>
        </section>

        <section className="card">
          <h2>{t.yourName}</h2>
          <div className="form-grid single">
            <label className={`field ${errors.name ? 'has-error' : ''}`}>
              <span className="sr-only">{t.yourName}</span>
              <input name="name" autoComplete="given-name" maxLength={30} value={ctx.name || ''} placeholder={t.namePh}
                onChange={(e) => { setCtx((c) => ({ ...c, name: e.target.value })); setErrors((x) => ({ ...x, name: null })); }} />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </label>
          </div>
          <label className="field">
            <span className="field-label">{t.orderNote} <em>{t.optional}</em></span>
            <textarea rows={2} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.orderNotePh} />
          </label>
        </section>

        <section className="card pay-card">
          <h2>{t.payment}</h2>
          <div className="pay-option is-active">
            <Wallet size={22} />
            <div>
              <strong>{t.payAtCounter}</strong>
              <p className="muted">{t.payAtCounterSub}</p>
            </div>
          </div>
        </section>

        <div className="summary">
          <div className="summary-row total"><span>{t.total}</span><span>{rm(total)}</span></div>
        </div>
        {serverError && <div className="form-alert"><TriangleAlert size={18} /> {serverError}</div>}
        <div className="checkout-spacer" />
      </main>

      <div className="checkout-bar">
        <div className="checkout-bar-inner">
          <div>
            <span className="muted small">{t.total}</span>
            <strong className="checkout-total">{rm(total)}</strong>
          </div>
          <button type="button" className="btn btn-primary btn-lg" onClick={placeOrder}
            disabled={busy || !menu.store.open || unavailable.length > 0}>
            {busy ? <Spinner /> : t.placeOrder}
          </button>
        </div>
      </div>

      <ItemSheet item={editing?.item} line={editing} open={!!editing} onClose={() => setEditing(null)}
        onDone={() => toast(lang === 'zh' ? '已更新' : 'Updated')} />
    </div>
  );
}
