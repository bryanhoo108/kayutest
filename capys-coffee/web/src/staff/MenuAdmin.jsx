import { useState } from 'react';
import { Pencil, Star } from 'lucide-react';
import DrinkArt from '../components/DrinkArt.jsx';
import { Sheet, SheetHeader, Spinner, Switch, useToast } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { rm } from '../lib/format.js';
import { useStaff } from './StaffApp.jsx';

function EditSheet({ item, categories, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    name: item.name, nameZh: item.nameZh, tagline: item.tagline, taglineZh: item.taglineZh,
    description: item.description, descriptionZh: item.descriptionZh, price: (item.price / 100).toFixed(2), categoryId: item.categoryId, featured: item.featured,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    const price = Math.round(Number(form.price) * 100);
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (!Number.isFinite(price) || price < 0) { setError('Enter a valid price'); return; }
    setBusy(true);
    setError('');
    try {
      await api.patch(`/api/staff/items/${item.id}`, { ...form, price });
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onClose} label={`Edit ${item.name}`} size="md">
      <SheetHeader title="Edit item" subtitle={item.name} onClose={onClose} />
      <div className="sheet-body">
        <div className="form-grid">
          <label className="field"><span className="field-label">Name (English)</span><input className="input" maxLength={60} value={form.name} onChange={set('name')} /></label>
          <label className="field"><span className="field-label">Name (中文)</span><input className="input" maxLength={30} value={form.nameZh} onChange={set('nameZh')} /></label>
          <label className="field"><span className="field-label">Tagline</span><input className="input" maxLength={40} value={form.tagline} onChange={set('tagline')} /></label>
          <label className="field"><span className="field-label">Tagline (中文)</span><input className="input" maxLength={30} value={form.taglineZh} onChange={set('taglineZh')} /></label>
        </div>
        <label className="field"><span className="field-label">Description</span><textarea className="input" rows={2} maxLength={240} value={form.description} onChange={set('description')} /></label>
        <label className="field"><span className="field-label">Description (中文)</span><textarea className="input" rows={2} maxLength={120} value={form.descriptionZh} onChange={set('descriptionZh')} /></label>
        <div className="form-grid">
          <label className="field">
            <span className="field-label">Price</span>
            <div className="money-input"><span>RM</span><input type="number" inputMode="decimal" min="0" step="0.10" value={form.price} onChange={set('price')} /></div>
          </label>
          <label className="field">
            <span className="field-label">Category</span>
            <select className="input" value={form.categoryId} onChange={set('categoryId')}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>
        <label className="switch-row">
          <Switch checked={form.featured} onChange={(v) => setForm((f) => ({ ...f, featured: v }))} label="Feature on the menu banner" />
          <span><strong>Feature on the menu banner</strong><br /><span className="muted small">Shown as the big hero at the top of the customer menu.</span></span>
        </label>
        {error && <p className="field-error">{error}</p>}
      </div>
      <div className="sheet-footer two">
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>{busy ? <Spinner /> : 'Save changes'}</button>
      </div>
    </Sheet>
  );
}

export default function MenuAdmin() {
  const { menu, setMenu, handleError } = useStaff();
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [pending, setPending] = useState({});

  const refresh = () => api.get('/api/menu').then(setMenu).catch(handleError);

  const patch = async (item, body, msg) => {
    setPending((p) => ({ ...p, [item.id]: true }));
    // optimistic
    setMenu((m) => ({ ...m, items: m.items.map((i) => (i.id === item.id ? { ...i, ...body } : i)) }));
    try {
      await api.patch(`/api/staff/items/${item.id}`, body);
      if (msg) toast(msg);
    } catch (e) {
      handleError(e);
      refresh();
    } finally {
      setPending((p) => ({ ...p, [item.id]: false }));
    }
  };

  const soldOut = menu.items.filter((i) => !i.available).length;

  return (
    <div className="page menu-admin">
      <p className="page-intro muted">
        Toggle a drink off when you run out — it shows as <strong>Sold out</strong> on every customer’s phone instantly.
        {soldOut > 0 && <> <span className="badge badge-cancelled">{soldOut} sold out</span></>}
      </p>
      {menu.categories.map((c) => {
        const items = menu.items.filter((i) => i.categoryId === c.id);
        if (!items.length) return null;
        return (
          <section key={c.id} className="card admin-cat">
            <h2>{c.name} <span className="muted">{c.nameZh}</span></h2>
            <ul className="admin-items">
              {items.map((i) => (
                <li key={i.id} className={i.available ? '' : 'is-soldout'}>
                  <span className="ai-art" style={{ background: i.art.tint }}><DrinkArt art={i.art} size={40} /></span>
                  <span className="ai-name">
                    <strong>{i.name}{i.featured && <Star size={14} className="star" fill="currentColor" />}</strong>
                    <span className="muted small">{i.nameZh} · {i.tagline}</span>
                  </span>
                  <span className="ai-price">{rm(i.price)}</span>
                  <label className="ai-avail">
                    <Switch checked={i.available} disabled={pending[i.id]} label={`${i.name} available`}
                      onChange={(v) => patch(i, { available: v }, v ? `${i.name} is back on` : `${i.name} marked sold out`)} />
                    <span className={i.available ? 'ok' : 'off'}>{i.available ? 'Available' : 'Sold out'}</span>
                  </label>
                  <button type="button" className="icon-btn" onClick={() => setEditing(i)} aria-label={`Edit ${i.name}`}><Pencil size={17} /></button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {editing && (
        <EditSheet item={editing} categories={menu.categories} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); toast('Menu updated'); }} />
      )}
    </div>
  );
}
