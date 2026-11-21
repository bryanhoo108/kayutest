import { useEffect, useState } from 'react';
import { ExternalLink, Printer, QrCode, TriangleAlert, Monitor, Copy } from 'lucide-react';
import { Spinner, Switch, useToast } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useStaff } from './StaffApp.jsx';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function orderingBase(store) {
  return (store?.publicUrl || window.location.origin).replace(/\/+$/, '');
}

function printPoster(base, storeName) {
  const root = document.getElementById('print-root');
  root.innerHTML = `
    <div class="poster">
      <img class="poster-logo" src="/logo.svg" alt="">
      <div class="poster-title">Scan to order</div>
      <div class="poster-zh">扫码点单</div>
      <img class="poster-qr" src="/api/qr?text=${encodeURIComponent(`${base}/`)}" alt="">
      <div class="poster-steps"><span>① Order on your phone</span><span>② Pay at the truck</span><span>③ We’ll call your name</span></div>
      <div class="poster-url">${esc(base.replace(/^https?:\/\//, ''))}</div>
      <div class="poster-store">${esc(storeName)} · Every sip, a good mood</div>
    </div>`;
  document.body.classList.add('printing-poster');
  const imgs = [...root.querySelectorAll('img')];
  let pending = imgs.length;
  const done = () => setTimeout(() => { window.print(); document.body.classList.remove('printing-poster'); }, 100);
  imgs.forEach((img) => {
    if (img.complete) { if (--pending === 0) done(); } else {
      img.onload = img.onerror = () => { if (--pending === 0) done(); };
    }
  });
}

export default function SettingsPage() {
  const { menu, setMenu, handleError } = useStaff();
  const toast = useToast();
  const store = menu.store;
  const [name, setName] = useState(store.name);
  const [publicUrl, setPublicUrl] = useState(store.publicUrl || '');
  const [savingBasics, setSavingBasics] = useState(false);
  const [pin, setPin] = useState({ current: '', next: '', confirm: '' });
  const [pinBusy, setPinBusy] = useState(false);

  useEffect(() => { setName(store.name); setPublicUrl(store.publicUrl || ''); }, [store.name, store.publicUrl]);

  const patch = async (body, msg) => {
    try {
      await api.patch('/api/staff/settings', body);
      setMenu(await api.get('/api/menu'));
      if (msg) toast(msg);
      return true;
    } catch (e) { handleError(e); return false; }
  };

  const saveBasics = async () => {
    setSavingBasics(true);
    await patch({ name, publicUrl }, 'Settings saved');
    setSavingBasics(false);
  };

  const changePin = async () => {
    if (pin.next !== pin.confirm) { toast('New PINs don’t match', 'error'); return; }
    setPinBusy(true);
    try {
      await api.post('/api/staff/pin', { current: pin.current, next: pin.next });
      toast('PIN changed');
      setPin({ current: '', next: '', confirm: '' });
    } catch (e) { handleError(e); } finally { setPinBusy(false); }
  };

  const base = orderingBase(store);
  const isLocal = /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(base);
  const dirty = name !== store.name || publicUrl !== (store.publicUrl || '');

  return (
    <div className="page settings">
      <section className="card">
        <h2>Ordering</h2>
        <label className="switch-row">
          <Switch checked={store.open} onChange={(v) => patch({ open: v }, v ? 'Now accepting QR orders' : 'QR ordering paused')} label="Accept QR orders" />
          <span><strong>Accept QR orders</strong><br /><span className="muted small">Turn off when closing or when the bar is overloaded. Walk-up orders you take yourself still work.</span></span>
        </label>
        <label className="switch-row">
          <Switch checked={store.autoAccept} onChange={(v) => patch({ autoAccept: v }, v ? 'QR orders go straight to Preparing' : 'QR orders wait in New')} label="Auto-accept QR orders" />
          <span><strong>Auto-accept QR orders</strong><br /><span className="muted small">Skip the “New” column — QR orders go straight to Preparing.</span></span>
        </label>
      </section>

      <section className="card">
        <h2>Store</h2>
        <label className="field"><span className="field-label">Store name</span><input className="input" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="field">
          <span className="field-label">Ordering web address</span>
          <input className="input" placeholder={window.location.origin} value={publicUrl} onChange={(e) => setPublicUrl(e.target.value)} />
          <span className="muted small">The address inside your QR poster. Leave empty to use this one ({window.location.origin}).</span>
        </label>
        {isLocal && (
          <div className="alert-warn"><TriangleAlert size={18} /> <span>The QR poster currently points to <strong>{base}</strong>, which customers’ phones can’t open. Enter the address of your deployed site.</span></div>
        )}
        <div className="row-actions">
          <button type="button" className="btn btn-primary" disabled={!dirty || savingBasics} onClick={saveBasics}>{savingBasics ? <Spinner /> : 'Save'}</button>
        </div>
      </section>

      <section className="card">
        <h2><QrCode size={18} /> Order QR poster</h2>
        <p className="muted">Print this and stick it on the truck or menu board. Customers scan, order on their phone, then pay you when they come up.</p>
        <div className="qr-preview">
          <figure>
            <img src={`/api/qr?text=${encodeURIComponent(`${base}/`)}`} alt="QR code for the ordering page" width="150" height="150" />
            <figcaption>{base.replace(/^https?:\/\//, '')}</figcaption>
          </figure>
        </div>
        <div className="row-actions">
          <button type="button" className="btn btn-primary" onClick={() => printPoster(base, store.name)}><Printer size={17} /> Print QR poster</button>
          <button type="button" className="btn btn-ghost" onClick={() => { navigator.clipboard?.writeText(`${base}/`).then(() => toast('Link copied'), () => toast('Copy failed', 'error')); }}><Copy size={17} /> Copy menu link</button>
        </div>
      </section>

      <section className="card">
        <h2><Monitor size={18} /> Pickup screen</h2>
        <p className="muted">Optional. If you have a spare tablet, prop it facing the queue: it shows which order numbers are being made and which are ready, and chimes when one is ready.</p>
        <div className="row-actions">
          <a className="btn btn-ghost" href="/display" target="_blank" rel="noreferrer"><ExternalLink size={17} /> Open pickup screen</a>
        </div>
      </section>

      <section className="card">
        <h2>Staff PIN</h2>
        <div className="form-grid three">
          <label className="field"><span className="field-label">Current PIN</span><input className="input" type="password" inputMode="numeric" autoComplete="current-password" maxLength={8} value={pin.current} onChange={(e) => setPin((p) => ({ ...p, current: e.target.value.replace(/\D/g, '') }))} /></label>
          <label className="field"><span className="field-label">New PIN (4–8 digits)</span><input className="input" type="password" inputMode="numeric" autoComplete="new-password" maxLength={8} value={pin.next} onChange={(e) => setPin((p) => ({ ...p, next: e.target.value.replace(/\D/g, '') }))} /></label>
          <label className="field"><span className="field-label">Confirm new PIN</span><input className="input" type="password" inputMode="numeric" autoComplete="new-password" maxLength={8} value={pin.confirm} onChange={(e) => setPin((p) => ({ ...p, confirm: e.target.value.replace(/\D/g, '') }))} /></label>
        </div>
        <div className="row-actions">
          <button type="button" className="btn btn-primary" disabled={pinBusy || pin.current.length < 4 || pin.next.length < 4 || !pin.confirm} onClick={changePin}>{pinBusy ? <Spinner /> : 'Change PIN'}</button>
        </div>
      </section>
    </div>
  );
}
