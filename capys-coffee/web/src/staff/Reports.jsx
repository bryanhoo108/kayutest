import { useEffect, useState } from 'react';
import { Download, TriangleAlert } from 'lucide-react';
import { Empty, Spinner } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { duration, prettyDate, rm, rmShort, ymd, PAYMENT_LABEL } from '../lib/format.js';
import { useStaff } from './StaffApp.jsx';
import { DateRange } from './History.jsx';

function Kpi({ label, value, sub, tone }) {
  return (
    <div className={`kpi ${tone ? `kpi-${tone}` : ''}`}>
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  );
}

function hourLabel(h) {
  const s = h % 12 === 0 ? 12 : h % 12;
  return `${s}${h < 12 ? 'am' : 'pm'}`;
}

function BarChart({ data, valueKey, format, labelKey, labelFormat, height = 200 }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...data.map((d) => d[valueKey]));
  const nice = (() => {
    const p = 10 ** Math.floor(Math.log10(max));
    const n = [1, 2, 2.5, 5, 10].find((m) => m * p >= max) * p;
    return n;
  })();
  const ticks = [0, nice / 2, nice];
  const W = 640;
  const H = height;
  const padL = 56;
  const padB = 26;
  const padT = 10;
  const bw = (W - padL) / data.length;
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bar chart" preserveAspectRatio="none">
        {ticks.map((t) => {
          const y = padT + (H - padB - padT) * (1 - t / nice);
          return (
            <g key={t}>
              <line x1={padL} x2={W} y1={y} y2={y} className="grid" />
              <text x={padL - 8} y={y + 4} textAnchor="end" className="axis">{format(t)}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = (H - padB - padT) * (d[valueKey] / nice);
          const x = padL + i * bw + bw * 0.18;
          const w = bw * 0.64;
          const showLabel = data.length <= 16 || i % Math.ceil(data.length / 12) === 0;
          return (
            <g key={d[labelKey]} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={padL + i * bw} y={padT} width={bw} height={H - padB - padT} fill="transparent" />
              <rect x={x} y={H - padB - h} width={w} height={Math.max(0, h)} rx={Math.min(4, w / 2)} className={`bar ${hover === i ? 'is-hover' : ''}`} />
              {showLabel && <text x={x + w / 2} y={H - 8} textAnchor="middle" className="axis">{labelFormat(d[labelKey])}</text>}
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <div className="chart-tip" style={{ left: `${((padL + hover * bw + bw / 2) / W) * 100}%` }}>
          <strong>{labelFormat(data[hover][labelKey], true)}</strong>
          <span>{data[hover].orders} order{data[hover].orders === 1 ? '' : 's'} · {rm(data[hover].amount)}</span>
        </div>
      )}
    </div>
  );
}

export default function Reports() {
  const { menu, handleError, orders } = useStaff();
  const tz = menu?.store.timeZone;
  const [from, setFrom] = useState(() => ymd(tz));
  const [to, setTo] = useState(() => ymd(tz));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Refetch when the range changes, and whenever live orders change (today's numbers stay current).
  const liveKey = orders.map((o) => `${o.id}:${o.updatedAt}`).join(',');
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      api.get(`/api/staff/reports?from=${from}&to=${to}`).then(setData).catch(handleError).finally(() => setLoading(false));
    }, 150);
    return () => clearTimeout(t);
  }, [from, to, liveKey, handleError]);

  const single = from === to;
  let hours = [];
  if (data) {
    const active = data.byHour.filter((h) => h.orders > 0).map((h) => h.hour);
    const lo = Math.min(8, ...active);
    const hi = Math.max(22, ...active);
    hours = data.byHour.filter((h) => h.hour >= lo && h.hour <= hi);
  }
  const days = (() => {
    if (!data || single) return [];
    const out = [];
    const map = new Map(data.byDay.map((d) => [d.date, d]));
    const [y, m, d] = from.split('-').map(Number);
    const start = Date.UTC(y, m - 1, d);
    const [y2, m2, d2] = to.split('-').map(Number);
    const end = Date.UTC(y2, m2 - 1, d2);
    for (let t = start; t <= end && out.length < 400; t += 86400000) {
      const k = new Date(t).toISOString().slice(0, 10);
      out.push(map.get(k) || { date: k, orders: 0, amount: 0 });
    }
    return out;
  })();
  const maxItem = Math.max(1, ...(data?.items || []).map((i) => i.qty));
  const paidTotal = data ? Object.values(data.byMethod).reduce((s, m) => s + m.amount, 0) : 0;

  return (
    <div className="page reports">
      <div className="toolbar">
        <DateRange from={from} to={to} tz={tz} onChange={(f, t) => { setFrom(f); setTo(t); }} />
        <div className="toolbar-right">
          {loading && <Spinner />}
          <a className="btn btn-ghost" href={`/api/staff/export.csv?from=${from}&to=${to}`}><Download size={17} /> Export CSV</a>
        </div>
      </div>
      <p className="muted small range-label">{single ? prettyDate(from) : `${prettyDate(from)} – ${prettyDate(to)}`} · cancelled orders excluded</p>

      {!data ? <div className="page-center"><Spinner size={26} /></div> : (
        <>
          {data.unpaidOrders > 0 && (
            <div className="alert-warn"><TriangleAlert size={18} /> {data.unpaidOrders} order{data.unpaidOrders === 1 ? ' is' : 's are'} not marked paid ({rm(data.outstanding)}). Check History → Unpaid.</div>
          )}
          <div className="kpis">
            <Kpi label="Gross sales" value={rm(data.grossSales)} sub={`${rm(data.collected)} collected`} tone="brand" />
            <Kpi label="Orders" value={data.orders} sub={`${data.bySource.qr} QR · ${data.bySource.counter} walk-up`} />
            <Kpi label="Drinks sold" value={data.drinks} sub={data.orders ? `${(data.drinks / data.orders).toFixed(1)} per order` : '—'} />
            <Kpi label="Average order" value={rm(data.avgTicket)} sub={data.cancelled ? `${data.cancelled} cancelled` : 'No cancellations'} />
            <Kpi label="Median prep time" value={duration(data.medianPrepMs)} sub="Order placed → ready" />
          </div>

          {data.orders === 0 ? <Empty title="No sales in this period">Orders will show up here as they come in.</Empty> : (
            <div className="report-grid">
              <section className="card span-2">
                <div className="card-head"><h2>{single ? 'Sales by hour' : 'Sales by day'}</h2></div>
                {single
                  ? <BarChart data={hours} valueKey="amount" labelKey="hour" format={(v) => rmShort(v)} labelFormat={(h, long) => (long ? `${hourLabel(h)} – ${hourLabel((h + 1) % 24)}` : hourLabel(h))} />
                  : <BarChart data={days} valueKey="amount" labelKey="date" format={(v) => rmShort(v)} labelFormat={(d, long) => (long ? prettyDate(d) : d.slice(8))} />}
              </section>

              <section className="card">
                <div className="card-head"><h2>Best sellers</h2><span className="muted small">cups</span></div>
                <ol className="rank">
                  {data.items.map((i, idx) => (
                    <li key={i.itemId}>
                      <span className="rank-no">{idx + 1}</span>
                      <span className="rank-main">
                        <span className="rank-name">{i.name}</span>
                        <span className="rank-bar"><span style={{ width: `${(i.qty / maxItem) * 100}%` }} /></span>
                      </span>
                      <span className="rank-val"><strong>{i.qty}</strong><span className="muted small">{rm(i.amount)}</span></span>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="card">
                <div className="card-head"><h2>Payments</h2><span className="muted small">{rm(paidTotal)} collected</span></div>
                <ul className="methods">
                  {Object.entries(data.byMethod).map(([m, v]) => (
                    <li key={m}>
                      <span className="m-name">{PAYMENT_LABEL[m]}</span>
                      <span className="rank-bar"><span style={{ width: `${paidTotal ? (v.amount / paidTotal) * 100 : 0}%` }} /></span>
                      <span className="m-val"><strong>{rm(v.amount)}</strong><span className="muted small">{v.count} order{v.count === 1 ? '' : 's'}</span></span>
                    </li>
                  ))}
                  <li className="m-outstanding">
                    <span className="m-name">Not yet paid</span>
                    <span />
                    <span className="m-val"><strong>{rm(data.outstanding)}</strong><span className="muted small">{data.unpaidOrders} order{data.unpaidOrders === 1 ? '' : 's'}</span></span>
                  </li>
                </ul>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}
