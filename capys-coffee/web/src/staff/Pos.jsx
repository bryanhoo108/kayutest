import { useMemo, useRef, useState } from 'react';
import { Trash2, Printer, SlidersHorizontal, CupSoda } from 'lucide-react';
import DrinkArt from '../components/DrinkArt.jsx';
import { Empty, Sheet, SheetHeader, Stepper, useToast } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { orderNo, rm } from '../lib/format.js';
import { printOrder } from '../lib/print.js';
import PaymentDialog from './PaymentDialog.jsx';
import { useStaff } from './StaffApp.jsx';

const key = () => Math.random().toString(36).slice(2);
const sameOpts = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

function OptionsSheet({ line, menu, onSave, onClose }) {
  const item = line?.item;
  const groups = (menu.optionGroups || []).filter((g) => item?.options.includes(g.id));
  const [opts, setOpts] = useState(line?.options || {});
  const [note, setNote] = useState(line?.note || '');
  const [qty, setQty] = useState(line?.qty || 1);
  return (
    <Sheet open={!!line} onClose={onClose} label="Customise" size="sm">
      {item && (
        <>
          <SheetHeader title={item.name} subtitle={rm(item.price)} onClose={onClose} />
          <div className="sheet-body">
            {groups.map((g) => (
              <fieldset key={g.id} className="opt-group">
                <legend>{g.name}</legend>
                <div className="opt-choices">
                  {g.choices.map((c) => (
                    <label key={c.id} className={`opt-chip ${opts[g.id] === c.id ? 'is-active' : ''}`}>
                      <input type="radio" name={`pos-${g.id}`} checked={opts[g.id] === c.id} onChange={() => setOpts((o) => ({ ...o, [g.id]: c.id }))} />
                      {c.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            <label className="field">
              <span className="field-label">Note for this drink</span>
              <input className="input" maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. separate cup" />
            </label>
          </div>
          <div className="sheet-footer item-footer">
            <Stepper value={qty} onChange={setQty} />
            <button type="button" className="btn btn-primary btn-lg grow" onClick={() => onSave({ ...line, options: opts, note: note.trim(), qty })}>
              Save · {rm(item.price * qty)}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}

export default function Pos() {
  const { menu, upsert, mine, handleError } = useStaff();
  const toast = useToast();
  const [cat, setCat] = useState('all');
  const [lines, setLines] = useState([]);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState(null);
  const [paying, setPaying] = useState(false);
  const [last, setLast] = useState(null);
  const cartRef = useRef(null);

  const defaults = useMemo(() => Object.fromEntries((menu?.optionGroups || []).map((g) => [g.id, g.default])), [menu]);
  const items = (menu?.items || []).filter((i) => cat === 'all' || i.categoryId === cat);
  const total = lines.reduce((s, l) => s + l.item.price * l.qty, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);

  const add = (item) => {
    if (!item.available) return;
    const opts = Object.fromEntries(item.options.map((g) => [g, defaults[g]]));
    setLines((ls) => {
      const i = ls.findIndex((l) => l.item.id === item.id && sameOpts(l.options, opts) && !l.note);
      if (i >= 0) {
        const next = [...ls];
        next[i] = { ...next[i], qty: Math.min(50, next[i].qty + 1) };
        return next;
      }
      return [...ls, { key: key(), item, qty: 1, options: opts, note: '' }];
    });
  };

  const optionLabel = (l) => {
    const groups = menu.optionGroups.filter((g) => l.item.options.includes(g.id));
    const changed = groups.map((g) => {
      const c = g.choices.find((x) => x.id === l.options[g.id]);
      return c && c.id !== g.default ? c.name : null;
    }).filter(Boolean);
    return changed;
  };

  const reset = () => { setLines([]); setName(''); setNote(''); };

  const submit = async (payment) => {
    try {
      const order = await api.post('/api/staff/orders', {
        type: 'takeaway',
        customerName: name,
        note,
        items: lines.map((l) => ({ itemId: l.item.id, qty: l.qty, options: l.options, note: l.note })),
        payment: payment || undefined,
      });
      mine.current.add(order.id);
      upsert(order);
      setPaying(false);
      setLast(order);
      reset();
      const change = payment?.cashReceived ? ` · Change ${rm(payment.cashReceived - order.total)}` : '';
      toast(`${orderNo(order.number)} sent to the bar${change}`, 'success', 5000);
    } catch (e) {
      handleError(e);
      throw e;
    }
  };

  return (
    <div className="pos">
      <section className="pos-menu">
        <div className="pos-cats" role="tablist">
          <button type="button" className={cat === 'all' ? 'is-active' : ''} onClick={() => setCat('all')}>All</button>
          {menu.categories.map((c) => (
            <button key={c.id} type="button" className={cat === c.id ? 'is-active' : ''} onClick={() => setCat(c.id)}>{c.name}</button>
          ))}
        </div>
        <div className="pos-grid">
          {items.map((i) => (
            <button key={i.id} type="button" className={`pos-tile ${i.available ? '' : 'is-soldout'}`} onClick={() => add(i)} disabled={!i.available}>
              <span className="pos-tile-art" style={{ background: i.art.tint }}><DrinkArt art={i.art} size={54} /></span>
              <span className="pos-tile-name">{i.name}</span>
              <span className="pos-tile-price">{i.available ? rm(i.price) : 'Sold out'}</span>
              {lines.filter((l) => l.item.id === i.id).reduce((s, l) => s + l.qty, 0) > 0 && (
                <b className="pos-tile-count">{lines.filter((l) => l.item.id === i.id).reduce((s, l) => s + l.qty, 0)}</b>
              )}
            </button>
          ))}
        </div>
      </section>

      <aside className="pos-cart" ref={cartRef}>
        <div className="pos-cart-head">
          <h2>New order</h2>
          {lines.length > 0 && <button type="button" className="link-danger" onClick={reset}><Trash2 size={15} /> Clear</button>}
        </div>
        <div className="pos-lines">
          {lines.length === 0 ? (
            <Empty icon={<CupSoda size={28} />} title="Tap drinks to add">
              Tap a line to change ice, sweetness or add a note.
              {last && <><br /><br /><button type="button" className="btn btn-ghost btn-sm" onClick={() => printOrder(last, { storeName: menu.store.name, timeZone: menu.store.timeZone })}><Printer size={15} /> Print receipt for {orderNo(last.number)}</button></>}
            </Empty>
          ) : (
            <ul>
              {lines.map((l) => {
                const opts = optionLabel(l);
                return (
                  <li key={l.key}>
                    <button type="button" className="pos-line-main" onClick={() => setEditing(l)}>
                      <span className="pl-name">{l.item.name}</span>
                      <span className="pl-opts">
                        {opts.length ? opts.join(' · ') : <span className="muted"><SlidersHorizontal size={12} /> Customise</span>}
                        {l.note && <em> · “{l.note}”</em>}
                      </span>
                    </button>
                    <Stepper size="sm" min={0} value={l.qty} onChange={(q) => setLines((ls) => (q === 0 ? ls.filter((x) => x.key !== l.key) : ls.map((x) => (x.key === l.key ? { ...x, qty: q } : x))))} />
                    <span className="pl-price">{rm(l.item.price * l.qty)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="pos-details">
          <input className="input" placeholder="Customer name (optional)" maxLength={30} value={name} onChange={(e) => setName(e.target.value)} aria-label="Customer name" />
          <input className="input" placeholder="Order note (optional)" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} aria-label="Order note" />
        </div>
        <div className="pos-total">
          <span>{count} drink{count === 1 ? '' : 's'}</span>
          <strong>{rm(total)}</strong>
        </div>
        <button type="button" className="btn btn-primary btn-lg btn-block" disabled={!lines.length} onClick={() => setPaying(true)}>
          Charge {rm(total)}
        </button>
      </aside>

      {lines.length > 0 && (
        <button type="button" className="pos-mobile-bar" onClick={() => cartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
          <span className="cart-count"><CupSoda size={17} /> {count}</span>
          <span className="cart-label">Review &amp; charge</span>
          <span className="cart-total">{rm(total)}</span>
        </button>
      )}

      {editing && (
        <OptionsSheet
          key={editing.key}
          line={editing}
          menu={menu}
          onClose={() => setEditing(null)}
          onSave={(l) => { setLines((ls) => ls.map((x) => (x.key === l.key ? l : x))); setEditing(null); }}
        />
      )}

      <PaymentDialog
        open={paying}
        onClose={() => setPaying(false)}
        total={total}
        title="Charge order"
        subtitle={`${count} drink${count === 1 ? '' : 's'}${name ? ` · ${name}` : ''}`}
        confirmLabel="Paid · Send to bar"
        onPay={(p) => submit(p).catch(() => {})}
        extraAction={<button type="button" className="btn btn-ghost" onClick={() => submit(null).catch(() => {})}>Pay later</button>}
      />
    </div>
  );
}
