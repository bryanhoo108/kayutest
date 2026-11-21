import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize, Volume2 } from 'lucide-react';
import { Logo } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { orderNo } from '../lib/format.js';
import { chimeReady, unlockAudio } from '../lib/sound.js';
import { useLive, useNow } from '../lib/useLive.js';

export default function DisplayBoard() {
  const [board, setBoard] = useState({ preparing: [], ready: [] });
  const [store, setStore] = useState(null);
  const [soundOn, setSoundOn] = useState(false);
  const [fresh, setFresh] = useState(new Set());
  const known = useRef(null);
  const now = useNow(10000);

  const fetchAll = useCallback(() => {
    api.get('/api/display').then(apply).catch(() => {});
    api.get('/api/menu').then((m) => setStore(m.store)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function apply(b) {
    const readyNums = new Set(b.ready.map((r) => r.number));
    if (known.current) {
      const added = [...readyNums].filter((n) => !known.current.has(n));
      if (added.length) {
        chimeReady();
        setFresh(new Set(added));
        setTimeout(() => setFresh(new Set()), 8000);
      }
    }
    known.current = readyNums;
    setBoard(b);
  }

  useEffect(fetchAll, [fetchAll]);
  const live = useLive('/api/stream?display=1', { board: apply, menu: (m) => setStore(m.store) }, fetchAll);

  useEffect(() => {
    document.title = "Pickup · Capy's Coffee";
    document.body.classList.add('display-mode');
    return () => document.body.classList.remove('display-mode');
  }, []);

  const base = (store?.publicUrl || window.location.origin).replace(/\/+$/, '');
  const enable = () => {
    unlockAudio();
    setSoundOn(true);
    document.documentElement.requestFullscreen?.().catch(() => {});
  };

  return (
    <div className="display">
      <header className="display-head">
        <div className="display-brand"><Logo size={72} /><div><strong>{store?.name || "Capy's Coffee"}</strong><span>Every sip, a good mood · 每一口，都是好心情</span></div></div>
        <div className="display-clock">
          {new Date(now).toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit', timeZone: store?.timeZone })}
          <span className={`live-dot ${live === 'live' ? 'is-live' : ''}`} />
        </div>
      </header>
      <main className="display-main">
        <section className="display-col preparing">
          <h2>Preparing <span>制作中</span></h2>
          <div className="num-grid">
            {board.preparing.length === 0 && <p className="display-empty">—</p>}
            {board.preparing.map((o) => (
              <div key={o.number} className="num"><b>{orderNo(o.number)}</b>{o.name && <span>{o.name}</span>}</div>
            ))}
          </div>
        </section>
        <section className="display-col ready">
          <h2>Ready for pickup <span>请取餐</span></h2>
          <div className="num-grid big">
            {board.ready.length === 0 && <p className="display-empty">Your number will appear here</p>}
            {board.ready.map((o) => (
              <div key={o.number} className={`num ${fresh.has(o.number) ? 'is-fresh' : ''}`}><b>{orderNo(o.number)}</b>{o.name && <span>{o.name}</span>}</div>
            ))}
          </div>
        </section>
        <aside className="display-qr">
          <img src={`/api/qr?text=${encodeURIComponent(`${base}/`)}`} alt="Scan to order" />
          <strong>Scan to order</strong>
          <span>扫码点单</span>
        </aside>
      </main>
      {!soundOn && (
        <button type="button" className="display-enable" onClick={enable}>
          <Volume2 size={20} /> Tap to enable sound & full screen <Maximize size={18} />
        </button>
      )}
    </div>
  );
}
