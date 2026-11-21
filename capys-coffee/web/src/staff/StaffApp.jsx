import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import {
  ChefHat, LayoutGrid, ScrollText, Coffee, ChartColumn, Settings, LogOut, Volume2, VolumeX, Wifi, WifiOff, Monitor, Lock, Delete,
} from 'lucide-react';
import { Logo, Spinner, Switch, useToast } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { load, save } from '../lib/storage.js';
import { useLive, useNow } from '../lib/useLive.js';
import { chimeNewOrder, unlockAudio } from '../lib/sound.js';
import Board from './Board.jsx';
import Pos from './Pos.jsx';
import History from './History.jsx';
import MenuAdmin from './MenuAdmin.jsx';
import Reports from './Reports.jsx';
import SettingsPage from './Settings.jsx';

const Ctx = createContext(null);
export const useStaff = () => useContext(Ctx);

export default function StaffApp() {
  const [signedIn, setSignedIn] = useState(null);
  useEffect(() => {
    api.get('/api/staff/me').then((r) => setSignedIn(r.signedIn)).catch(() => setSignedIn(false));
  }, []);
  if (signedIn === null) return <div className="page-center"><Spinner size={28} /></div>;
  if (!signedIn) return <Login onDone={() => setSignedIn(true)} />;
  return <StaffShell onSignedOut={() => setSignedIn(false)} />;
}

/* ---------------- Login ---------------- */

function Login({ onDone }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);

  const submit = useCallback(async (value) => {
    setBusy(true);
    setError('');
    try {
      await api.post('/api/staff/login', { pin: value });
      unlockAudio();
      onDone();
    } catch (e) {
      setError(e.message);
      setPin('');
      setShake(true);
      setTimeout(() => setShake(false), 450);
    } finally {
      setBusy(false);
    }
  }, [onDone]);

  const press = (d) => {
    if (busy) return;
    setError('');
    setPin((p) => (p.length >= 8 ? p : p + d));
  };

  useEffect(() => {
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') setPin((p) => p.slice(0, -1));
      else if (e.key === 'Enter') setPin((p) => { if (p.length >= 4) submit(p); return p; });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="login">
      <div className="login-card">
        <Logo size={92} />
        <h1>Staff sign in</h1>
        <p className="muted">Enter your PIN to open the barista station</p>
        <div className={`pin-dots ${shake ? 'shake' : ''}`} aria-label={`${pin.length} digits entered`}>
          {Array.from({ length: Math.max(4, pin.length) }, (_, i) => <span key={i} className={i < pin.length ? 'is-filled' : ''} />)}
        </div>
        <p className="login-error" role="alert">{error}</p>
        <div className="keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} type="button" onClick={() => press(d)}>{d}</button>
          ))}
          <button type="button" className="key-muted" onClick={() => setPin('')} aria-label="Clear">C</button>
          <button type="button" onClick={() => press('0')}>0</button>
          <button type="button" className="key-muted" onClick={() => setPin((p) => p.slice(0, -1))} aria-label="Delete"><Delete size={22} /></button>
        </div>
        <button type="button" className="btn btn-primary btn-lg btn-block" disabled={pin.length < 4 || busy} onClick={() => submit(pin)}>
          {busy ? <Spinner /> : <><Lock size={18} /> Sign in</>}
        </button>
      </div>
    </div>
  );
}

/* ---------------- Shell ---------------- */

const NAV = [
  { to: 'orders', label: 'Orders', icon: ChefHat },
  { to: 'pos', label: 'Take order', icon: LayoutGrid },
  { to: 'history', label: 'History', icon: ScrollText },
  { to: 'menu', label: 'Menu', icon: Coffee },
  { to: 'reports', label: 'Reports', icon: ChartColumn },
  { to: 'settings', label: 'Settings', icon: Settings },
];

function StaffShell({ onSignedOut }) {
  const toast = useToast();
  const [orders, setOrders] = useState(new Map());
  const [menu, setMenu] = useState(null);
  const [sound, setSound] = useState(() => load('capys.staff.sound', true));
  const [loaded, setLoaded] = useState(false);
  const mine = useRef(new Set()); // orders created on this device (no chime)
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const location = useLocation();

  useEffect(() => save('capys.staff.sound', sound), [sound]);

  const handleError = useCallback((e) => {
    if (e?.status === 401) { onSignedOut(); return; }
    toast(e.message || 'Something went wrong', 'error');
  }, [onSignedOut, toast]);

  const refresh = useCallback(() => {
    api.get('/api/staff/board').then((r) => {
      setOrders(new Map(r.orders.map((o) => [o.id, o])));
      setLoaded(true);
    }).catch(handleError);
    api.get('/api/menu').then(setMenu).catch(handleError);
  }, [handleError]);
  useEffect(refresh, [refresh]);

  const upsert = useCallback((o) => {
    setOrders((prev) => {
      const cur = prev.get(o.id);
      if (cur && cur.updatedAt > o.updatedAt) return prev;
      const next = new Map(prev);
      next.set(o.id, o);
      return next;
    });
  }, []);

  const ordersRef = useRef(orders);
  ordersRef.current = orders;
  const announced = useRef(new Set());

  const live = useLive('/api/staff/stream', {
    order: (o) => {
      const isNew = !ordersRef.current.has(o.id) && !mine.current.has(o.id) && !announced.current.has(o.id);
      if (isNew && o.status !== 'completed' && o.status !== 'cancelled') {
        announced.current.add(o.id);
        if (soundRef.current) chimeNewOrder();
        toast(`New order #${String(o.number).padStart(3, '0')} · ${o.customerName || (o.source === 'qr' ? 'QR order' : 'Walk-up')}`, 'info', 5000);
      }
      upsert(o);
    },
    menu: (m) => setMenu(m),
  }, refresh);

  // Unlock audio on first interaction so chimes can play.
  useEffect(() => {
    const u = () => unlockAudio();
    window.addEventListener('pointerdown', u);
    return () => window.removeEventListener('pointerdown', u);
  }, []);

  const list = useMemo(() => [...orders.values()].sort((a, b) => a.createdAt - b.createdAt), [orders]);
  const newCount = list.filter((o) => o.status === 'new').length;

  useEffect(() => {
    document.title = newCount ? `(${newCount}) New orders · Capy's Staff` : "Capy's Staff";
  }, [newCount]);

  /** Run an API action that returns an updated order; applies it optimistically-safe. */
  const act = useCallback(async (fn, okMsg) => {
    try {
      const o = await fn();
      if (o && o.id) upsert(o);
      if (okMsg) toast(okMsg);
      return o;
    } catch (e) {
      handleError(e);
      return null;
    }
  }, [upsert, toast, handleError]);

  const setStore = async (patch) => {
    try {
      await api.patch('/api/staff/settings', patch);
      setMenu(await api.get('/api/menu'));
    } catch (e) { handleError(e); }
  };

  const logout = async () => {
    await api.post('/api/staff/logout').catch(() => {});
    onSignedOut();
  };

  const value = {
    orders: list, upsert, menu, setMenu, act, handleError, mine, live, sound, setSound, loaded, refresh, setStore,
  };

  return (
    <Ctx.Provider value={value}>
      <div className="staff">
        <aside className="staff-nav">
          <div className="staff-brand"><Logo size={40} /><span>Capy’s<small>Staff</small></span></div>
          <nav>
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'is-active' : '')}>
                <n.icon size={22} />
                <span>{n.label}</span>
                {n.to === 'orders' && newCount > 0 && <b className="nav-badge">{newCount}</b>}
              </NavLink>
            ))}
          </nav>
          <div className="staff-nav-foot">
            <a href="/display" target="_blank" rel="noreferrer"><Monitor size={20} /><span>Pickup screen</span></a>
            <button type="button" onClick={logout}><LogOut size={20} /><span>Sign out</span></button>
          </div>
        </aside>
        <div className="staff-main">
          <TopBar key={location.pathname} />
          <div className="staff-content">
            {!loaded || !menu ? <div className="page-center"><Spinner size={28} /></div> : (
              <Routes>
                <Route index element={<Navigate to="orders" replace />} />
                <Route path="orders" element={<Board />} />
                <Route path="pos" element={<Pos />} />
                <Route path="history" element={<History />} />
                <Route path="menu" element={<MenuAdmin />} />
                <Route path="reports" element={<Reports />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="orders" replace />} />
              </Routes>
            )}
          </div>
        </div>
      </div>
    </Ctx.Provider>
  );
}

function TopBar() {
  const { menu, live, sound, setSound, setStore } = useStaff();
  const now = useNow(15000);
  const open = !!menu?.store.open;
  const title = NAV.find((n) => window.location.pathname.includes(`/staff/${n.to}`))?.label || 'Orders';
  return (
    <header className="topbar">
      <h1>{title}</h1>
      <div className="topbar-actions">
        <label className={`store-toggle ${open ? 'is-open' : ''}`}>
          <Switch checked={open} onChange={(v) => setStore({ open: v })} label="Accepting QR orders" />
          <span>{open ? 'Accepting orders' : 'Ordering paused'}</span>
        </label>
        <button type="button" className={`icon-btn ${sound ? '' : 'is-off'}`} onClick={() => { unlockAudio(); setSound(!sound); }}
          aria-label={sound ? 'Mute new-order sound' : 'Turn on new-order sound'} title={sound ? 'Sound on' : 'Sound off'}>
          {sound ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
        <span className={`conn conn-${live}`} title={live === 'live' ? 'Live — orders update instantly' : 'Reconnecting…'}>
          {live === 'live' ? <Wifi size={16} /> : <WifiOff size={16} />}
          <span>{live === 'live' ? 'Live' : 'Offline'}</span>
        </span>
        <span className="clock">{new Date(now).toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit', timeZone: menu?.store.timeZone })}</span>
      </div>
    </header>
  );
}
