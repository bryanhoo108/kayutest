import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Receipt, Store, CupSoda, Sparkles, ChevronRight, RefreshCw } from 'lucide-react';
import DrinkArt from '../components/DrinkArt.jsx';
import { Logo, Sheet, SheetHeader, Spinner, useToast } from '../components/ui.jsx';
import { orderNo, rm, rmShort } from '../lib/format.js';
import { useShop } from './store.jsx';
import ItemSheet from './ItemSheet.jsx';

export function ShopHeader({ back }) {
  const { menu, t, lang, setLang, orders } = useShop();
  const [showOrders, setShowOrders] = useState(false);
  const open = menu?.store.open;
  return (
    <header className="shop-header">
      <div className="shop-header-inner">
        {back || (
          <Link to="/" className="brand" aria-label="Capy's Coffee home">
            <Logo size={46} />
            <div>
              <strong>{menu?.store.name || "Capy's Coffee"}</strong>
              {menu && (
                <span className={`status-dot ${open ? 'is-open' : 'is-closed'}`}>{open ? t.open : t.closed}</span>
              )}
            </div>
          </Link>
        )}
        <div className="shop-header-actions">
          {orders.length > 0 && (
            <button type="button" className="chip-btn" onClick={() => setShowOrders(true)}>
              <Receipt size={16} /> <span>{t.myOrders}</span>
            </button>
          )}
          <button type="button" className="chip-btn lang-btn" onClick={() => setLang(lang === 'en' ? 'zh' : 'en')} aria-label="Switch language">
            {lang === 'en' ? '中文' : 'EN'}
          </button>
        </div>
      </div>
      <MyOrdersSheet open={showOrders} onClose={() => setShowOrders(false)} />
    </header>
  );
}

function MyOrdersSheet({ open, onClose }) {
  const { orders, orderUpdates, t } = useShop();
  const navigate = useNavigate();
  return (
    <Sheet open={open} onClose={onClose} label={t.myOrders} size="sm">
      <SheetHeader title={t.myOrders} onClose={onClose} />
      <div className="sheet-body">
        {orders.length === 0 ? <p className="muted">{t.noActive}</p> : (
          <ul className="my-orders">
            {orders.map((o) => {
              const live = orderUpdates[o.token];
              const status = live?.status;
              return (
                <li key={o.token}>
                  <button type="button" onClick={() => { onClose(); navigate(`/order/${o.token}`); }}>
                    <span className="mo-no">{orderNo(o.number)}</span>
                    <span className="mo-meta">
                      {new Date(o.createdAt).toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit' })} · {rm(o.total)}
                    </span>
                    {status && <span className={`badge badge-${status}`}>{t[status === 'new' ? 'received' : status === 'completed' ? 'collected' : status] || status}</span>}
                    <ChevronRight size={18} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Sheet>
  );
}

function ItemCard({ item, onOpen }) {
  const { name, altName, t } = useShop();
  return (
    <article className={`item-card ${item.available ? '' : 'is-soldout'}`}>
      <button type="button" className="item-card-hit" onClick={() => onOpen(item)} aria-label={`${item.name}, ${rm(item.price)}`}>
        <div className="item-card-art" style={{ background: item.art.tint }}>
          {item.number && <span className="item-no">{String(item.number).padStart(2, '0')}</span>}
          <DrinkArt art={item.art} size={96} title={item.name} />
          {!item.available && <span className="soldout-badge">{t.soldOut}</span>}
        </div>
        <div className="item-card-body">
          <h3>{name(item)}</h3>
          <p className="alt-name">{altName(item)}</p>
          <p className="item-tagline">{name(item, 'tagline')}</p>
        </div>
      </button>
      <div className="item-card-foot">
        <span className="price">{rm(item.price)}</span>
        <button type="button" className="add-btn" onClick={() => onOpen(item)} disabled={!item.available} aria-label={`Add ${item.name}`}>
          <Plus size={20} strokeWidth={2.6} />
        </button>
      </div>
    </article>
  );
}

function Hero({ item, onOpen }) {
  const { t, name, altName } = useShop();
  return (
    <section className="hero">
      <div className="hero-text">
        <span className="hero-tag"><Sparkles size={14} /> {t.signatureTag}</span>
        <h1>{name(item)}</h1>
        <p className="hero-alt">{altName(item)}</p>
        <p className="hero-desc">{name(item, 'description')}</p>
        <div className="hero-cta">
          <button type="button" className="btn btn-light" onClick={() => onOpen(item)} disabled={!item.available}>
            {item.available ? <><Plus size={18} /> {t.add} · {rm(item.price)}</> : t.soldOut}
          </button>
        </div>
      </div>
      <div className="hero-art"><DrinkArt art={item.art} size={150} title={item.name} /></div>
      <div className="hero-waves" aria-hidden="true" />
    </section>
  );
}

export default function MenuPage() {
  const shop = useShop();
  const { menu, error, retry, t, name, count, total } = shop;
  const toast = useToast();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null);
  const [activeCat, setActiveCat] = useState(null);
  const sectionRefs = useRef({});
  const chipsRef = useRef(null);

  const featured = menu?.items.find((i) => i.featured);
  const sections = useMemo(() => {
    if (!menu) return [];
    return menu.categories
      .map((c) => {
        const items = menu.items.filter((i) => i.categoryId === c.id);
        const prices = [...new Set(items.map((i) => i.price))].sort((a, b) => a - b);
        // A category whose only drinks are already in the banner doesn't need its own section.
        const onlyHero = items.length > 0 && items.every((i) => i.featured) && featured && items.some((i) => i.id === featured.id);
        return { ...c, items, prices, onlyHero };
      })
      .filter((s) => s.items.length);
  }, [menu, featured]);

  // Scroll-spy for the category chips
  useEffect(() => {
    if (!sections.length) return undefined;
    const obs = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActiveCat(visible[0].target.dataset.cat);
    }, { rootMargin: '-140px 0px -55% 0px' });
    Object.values(sectionRefs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [sections]);

  useEffect(() => {
    const chip = chipsRef.current?.querySelector('.is-active');
    chip?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [activeCat]);

  const jump = (id) => {
    const el = sectionRefs.current[id];
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 128;
    window.scrollTo({ top: y, behavior: 'smooth' });
  };

  if (error && !menu) {
    return (
      <div className="page-center">
        <Logo size={88} />
        <h2>Can’t load the menu</h2>
        <p className="muted">{error}</p>
        <button type="button" className="btn btn-primary" onClick={retry}><RefreshCw size={18} /> Try again</button>
      </div>
    );
  }
  if (!menu) return <MenuSkeleton />;

  return (
    <div className="shop">
      <ShopHeader />
      <main className="shop-main">
        {!menu.store.open && <div className="closed-banner"><Store size={18} /> {t.closedBanner}</div>}

        <div className="how-it-works">
          <span><b>1</b>{t.step1}</span>
          <span><b>2</b>{t.step2}</span>
          <span><b>3</b>{t.step3}</span>
        </div>

        {featured && (
          <div className="hero-anchor" data-cat={sections.find((s) => s.onlyHero)?.id} ref={(el) => { const s = sections.find((x) => x.onlyHero); if (s) sectionRefs.current[s.id] = el; }}>
            <Hero item={featured} onOpen={setSelected} />
          </div>
        )}

        <nav className="cat-chips" ref={chipsRef} aria-label="Menu categories">
          {sections.map((s) => (
            <button key={s.id} type="button" className={activeCat === s.id ? 'is-active' : ''} onClick={() => jump(s.id)}>
              {name(s)}
            </button>
          ))}
        </nav>

        {sections.filter((s) => !s.onlyHero).map((s) => (
          <section key={s.id} className="menu-section" data-cat={s.id} ref={(el) => { sectionRefs.current[s.id] = el; }}>
            <div className="section-head">
              <h2>{name(s)}</h2>
              <span className="section-price">{s.prices.length > 1 ? `${rmShort(s.prices[0])} – ${rmShort(s.prices[s.prices.length - 1])}` : rmShort(s.prices[0])}</span>
            </div>
            <div className="item-grid">
              {s.items.map((i) => <ItemCard key={i.id} item={i} onOpen={setSelected} />)}
            </div>
          </section>
        ))}

        <footer className="shop-footer">
          <Logo size={64} />
          <p><strong>{t.thanks}</strong></p>
          <p className="muted">{t.everySip} · 每一口，都是好心情</p>
        </footer>
      </main>

      {count > 0 && (
        <div className="cart-bar-wrap">
          <button type="button" className="cart-bar" onClick={() => navigate('/checkout')}>
            <span className="cart-count"><CupSoda size={18} /> {count}</span>
            <span className="cart-label">{t.viewCart}</span>
            <span className="cart-total">{rm(total)}</span>
          </button>
        </div>
      )}

      <ItemSheet
        item={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onDone={(item, qty) => toast(`${qty} × ${name(item)} ${shop.lang === 'zh' ? '已加入' : 'added'}`)}
      />
    </div>
  );
}

function MenuSkeleton() {
  return (
    <div className="shop">
      <header className="shop-header"><div className="shop-header-inner"><div className="brand"><Logo size={46} /><div><strong>Capy’s Coffee</strong></div></div></div></header>
      <main className="shop-main">
        <div className="skel" style={{ height: 48, borderRadius: 14 }} />
        <div className="skel" style={{ height: 210, borderRadius: 24, marginTop: 16 }} />
        <div className="item-grid" style={{ marginTop: 28 }}>
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="skel" style={{ height: 250, borderRadius: 20 }} />)}
        </div>
        <div className="sr-only"><Spinner /></div>
      </main>
    </div>
  );
}
