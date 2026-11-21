import { useId } from 'react';

// Illustrated iced drink, driven by each menu item's `art` settings:
// { tint, layers: [{ c: colour, h: fraction of cup }...bottom→top], garnish, bubbles, noIce, drizzle }

const TOP = 26;
const BOTTOM = 138;
const H = BOTTOM - TOP;
const CUP = 'M24 26 L96 26 L88.4 133 Q88 138 83 138 L37 138 Q32 138 31.6 133 Z';

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  const r = f(n >> 16);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function Garnish({ type }) {
  switch (type) {
    case 'orange':
    case 'grapefruit':
    case 'lime': {
      const c = { orange: ['#F59E1B', '#FFD36E', '#E07F00'], grapefruit: ['#EE6B57', '#FFB1A1', '#D24E3B'], lime: ['#86C142', '#D8F09A', '#5E9A22'] }[type];
      return (
        <g transform="translate(100 128)">
          <circle r="15" fill={c[0]} stroke={c[2]} strokeWidth="1.5" />
          <circle r="11.5" fill={c[1]} />
          {[0, 45, 90, 135].map((a) => (
            <line key={a} x1="0" y1="-11" x2="0" y2="11" stroke={c[0]} strokeWidth="1.2" transform={`rotate(${a})`} />
          ))}
          <circle r="2" fill={c[0]} />
        </g>
      );
    }
    case 'strawberry':
      return (
        <g transform="translate(101 127)">
          <path d="M0 16 C-12 10 -15 -2 -10 -8 C-6 -12 6 -12 10 -8 C15 -2 12 10 0 16 Z" fill="#E63950" stroke="#C22540" strokeWidth="1.2" />
          {[[-5, -3], [3, -4], [-2, 3], [5, 3], [0, 9], [-6, 5]].map(([x, y]) => (
            <ellipse key={`${x}${y}`} cx={x} cy={y} rx="0.9" ry="1.3" fill="#FFE08A" />
          ))}
          <path d="M-9 -9 L-3 -12 L0 -16 L3 -12 L9 -9 L3 -9 L0 -6 L-3 -9 Z" fill="#4E9A2C" />
        </g>
      );
    case 'coconut':
      return (
        <g transform="translate(101 130)">
          <path d="M-16 0 A16 14 0 0 0 16 0 Z" fill="#6E4A2C" />
          <ellipse rx="16" ry="5" fill="#8A6040" />
          <ellipse rx="12.5" ry="3.6" fill="#FFFDF6" />
        </g>
      );
    case 'wheat':
      return (
        <g transform="translate(104 142) rotate(-14)" stroke="#B68C3E" strokeWidth="1.2" fill="#D9B566">
          <line x1="0" y1="0" x2="0" y2="-40" fill="none" />
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <ellipse cx="-3.4" cy={-22 - i * 4.4} rx="2.4" ry="4" transform={`rotate(-25 -3.4 ${-22 - i * 4.4})`} />
              <ellipse cx="3.4" cy={-22 - i * 4.4} rx="2.4" ry="4" transform={`rotate(25 3.4 ${-22 - i * 4.4})`} />
            </g>
          ))}
          <ellipse cx="0" cy="-45" rx="2.2" ry="4" />
        </g>
      );
    case 'oat':
      return (
        <g transform="translate(101 134)">
          <path d="M-15 -3 Q0 14 15 -3 Z" fill="#E7DCCB" stroke="#CDBA9C" strokeWidth="1.2" />
          {[[-8, -5], [-3, -7], [3, -6], [8, -5], [0, -4], [-5, -3], [5, -3]].map(([x, y], i) => (
            <ellipse key={i} cx={x} cy={y} rx="3" ry="1.8" fill="#D8BE8C" stroke="#B89C68" strokeWidth=".6" transform={`rotate(${i * 37} ${x} ${y})`} />
          ))}
        </g>
      );
    case 'chocolate':
      return (
        <g>
          <g transform="translate(97 132) rotate(-12)">
            <rect x="-9" y="-7" width="18" height="14" rx="2" fill="#4A2A1C" />
            <path d="M-9 0 H9 M0 -7 V7" stroke="#2E170D" strokeWidth="1.2" />
          </g>
          <g transform="translate(110 138) rotate(18)">
            <rect x="-6" y="-5" width="12" height="10" rx="1.6" fill="#5A3424" />
          </g>
        </g>
      );
    case 'beans':
      return (
        <g fill="#4A2A1C">
          {[[94, 140, -20], [106, 137, 25], [101, 129, 70]].map(([x, y, r]) => (
            <g key={`${x}${y}`} transform={`translate(${x} ${y}) rotate(${r})`}>
              <ellipse rx="5" ry="3.4" />
              <path d="M-4 0 Q0 -1.6 4 0" stroke="#A0704A" strokeWidth="0.9" fill="none" />
            </g>
          ))}
        </g>
      );
    default:
      return null;
  }
}

function Fish({ x, y, s = 1, flip }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <path d="M8 0 L14 -5 L13 0 L14 5 Z" fill="#FF8A3D" />
      <ellipse cx="0" cy="0" rx="9" ry="5.5" fill="#FF6B35" />
      <ellipse cx="-1" cy="-1.5" rx="5" ry="2.2" fill="#FFB067" opacity=".8" />
      <circle cx="-5" cy="-1" r="1.2" fill="#2A170D" />
    </g>
  );
}

export default function DrinkArt({ art = {}, size = 120, className = '', title }) {
  const raw = useId();
  const id = raw.replace(/[^a-zA-Z0-9]/g, '');
  const layers = art.layers?.length ? art.layers : [{ c: '#6B4430', h: 0.85 }];
  const total = Math.min(0.92, layers.reduce((s, l) => s + l.h, 0));
  const yTop = BOTTOM - H * total;
  const topColor = layers[layers.length - 1].c;

  // Soft gradient between layers, bottom (offset 0) → top (offset 1)
  const stops = [];
  let acc = 0;
  const blend = 0.035;
  layers.forEach((l, i) => {
    const start = acc / total;
    acc += l.h;
    const end = Math.min(1, acc / total);
    stops.push({ o: i === 0 ? 0 : start + blend, c: l.c });
    stops.push({ o: i === layers.length - 1 ? 1 : end - blend, c: l.c });
  });

  const ice = art.noIce ? [] : [
    { x: 38, y: yTop - 3, r: -12 },
    { x: 58, y: yTop - 6, r: 10 },
    { x: 76, y: yTop - 2, r: -4 },
    { x: 47, y: yTop + 13, r: 22 },
    { x: 68, y: yTop + 15, r: -18 },
  ];

  return (
    <svg viewBox="0 0 120 150" width={size} height={size * 1.25} className={`drink-art ${className}`} role="img" aria-label={title || 'Drink illustration'}>
      <defs>
        <clipPath id={`cup${id}`}><path d={CUP} /></clipPath>
        <linearGradient id={`liq${id}`} x1="0" y1={BOTTOM} x2="0" y2={yTop} gradientUnits="userSpaceOnUse">
          {stops.map((s, i) => <stop key={i} offset={Math.max(0, Math.min(1, s.o))} stopColor={s.c} />)}
        </linearGradient>
        <linearGradient id={`shine${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".0" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`depth${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#000" stopOpacity=".16" />
          <stop offset=".25" stopColor="#000" stopOpacity="0" />
          <stop offset=".75" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".2" />
        </linearGradient>
      </defs>

      <ellipse cx="60" cy="141" rx="36" ry="4.5" fill="#2A1810" opacity=".13" />

      <g clipPath={`url(#cup${id})`}>
        <rect x="0" y="0" width="120" height="150" fill="#FFFFFF" opacity=".45" />
        <rect x="0" y={yTop} width="120" height={BOTTOM - yTop + 2} fill={`url(#liq${id})`} />
        {art.drizzle && (
          <g stroke="#3A1E12" strokeWidth="3" fill="none" opacity=".75" strokeLinecap="round">
            <path d={`M30 ${yTop + 4} q4 14 0 26 q-3 12 2 22`} />
            <path d={`M90 ${yTop + 6} q-4 12 0 24 q3 10 -2 24`} />
            <path d={`M46 ${yTop + 2} q2 10 -1 18`} />
            <path d={`M74 ${yTop + 2} q-2 9 1 16`} />
          </g>
        )}
        {art.garnish === 'foam' && (
          <path d={`M20 ${yTop + 4} Q40 ${yTop - 7} 60 ${yTop - 3} Q80 ${yTop - 8} 100 ${yTop + 4} V${yTop + 10} H20 Z`} fill={shade(topColor, 0.08)} />
        )}
        <ellipse cx="60" cy={yTop} rx="38" ry="4" fill={shade(topColor, 0.12)} opacity=".9" />
        {art.bubbles && (
          <g fill="#fff" opacity=".7">
            {[[40, 128, 1.6], [52, 118, 1.2], [70, 124, 1.8], [80, 112, 1.1], [45, 104, 1.3], [64, 98, 1], [76, 132, 1.3], [58, 132, 1]].map(([x, y, r]) => (
              y > yTop + 4 ? <circle key={`${x}${y}`} cx={x} cy={y} r={r} /> : null
            ))}
          </g>
        )}
        {ice.map((c, i) => (
          <rect key={i} x={c.x - 8} y={c.y - 8} width="16" height="16" rx="3.5" transform={`rotate(${c.r} ${c.x} ${c.y})`}
            fill="#FFFFFF" fillOpacity=".28" stroke="#FFFFFF" strokeOpacity=".75" strokeWidth="1.2" />
        ))}
        {art.garnish === 'goldfish' && (
          <>
            <Fish x={52} y={yTop + 4} s={0.95} />
            <Fish x={72} y={yTop + 34} s={0.85} flip />
            <Fish x={46} y={yTop + 60} s={0.7} />
          </>
        )}
        <rect x="0" y="0" width="120" height="150" fill={`url(#depth${id})`} />
        <path d="M31 30 L35 130" stroke={`url(#shine${id})`} strokeWidth="5" strokeLinecap="round" opacity=".9" />
        <path d="M84 32 L82 70" stroke="#fff" strokeOpacity=".35" strokeWidth="2.5" strokeLinecap="round" />
      </g>

      <path d={CUP} fill="none" stroke="#3B2416" strokeOpacity=".22" strokeWidth="1.4" />
      <ellipse cx="60" cy="26" rx="36" ry="4.2" fill="#FFFFFF" fillOpacity=".55" stroke="#3B2416" strokeOpacity=".22" strokeWidth="1.4" />

      {/* sticker */}
      <g transform="translate(60 96)">
        <circle r="12.5" fill="#FFF9F0" stroke="#3B2416" strokeOpacity=".55" strokeWidth="1.1" />
        <ellipse cx="4.6" cy="-6.4" rx="2.1" ry="1.8" fill="#9A5A2E" />
        <path d="M-8 1 C-8.5 -5 -4 -8 1 -8 C6 -8 8.6 -4.5 8.6 0 C8.6 4.5 5.5 7 1.5 7 L-4 7 C-6.5 7 -7.8 4.5 -8 1 Z" fill="#C08048" />
        <path d="M-8 1 C-8 -2 -6 -3.4 -4 -3.2 C-1.6 -3 -0.8 -0.6 -1 2.6 C-1.2 5.6 -2.6 7 -4 7 C-6.3 7 -7.8 4.5 -8 1 Z" fill="#8E5229" />
        <circle cx="2.2" cy="-2.6" r="1.1" fill="#2A170D" />
      </g>

      <Garnish type={art.garnish} />
    </svg>
  );
}
