# Capy's Coffee — ordering system

Phone ordering for the Capy's Coffee truck, plus a station where the barista
takes, makes and charges orders. Every order is takeaway (no tables).

| Who | Address | What it does |
|---|---|---|
| Customers | `/` | Scan the QR poster, pick drinks, set ice and sweetness, enter a name, place the order, then watch it go *Received → Preparing → Ready* live. The phone chimes and vibrates when it's ready. English / 中文 toggle. |
| Barista | `/staff` | PIN sign-in. **Orders**: live board, New → Preparing → Ready → Collected, with a chime on each new order. **Take order**: ring up walk-up customers and charge them (cash with change, DuitNow QR or card). **History**, **Menu** (mark a drink sold out, change prices), **Reports** and **Settings**. |
| Queue (optional) | `/display` | Pickup screen for a spare tablet: shows which numbers are being made and which are ready. |

## Menu and prices

| Group | Price | Drinks |
|---|---|---|
| Americano | RM 6 | 01 Classic Iced Americano |
| Special americano | RM 8 | 02 Grapefruit · 03 Orange · 04 Cola · 05 Quicksand |
| Latte | RM 8 | 06 Brickmover's Iced Latte |
| Special latte | RM 10 | 07 Raw Coconut · 08 Wheatgrass · 09 Strawberry · 10 Mocha · 11 Oat |
| Signature | RM 10 | Blue Sea Goldfish Soda 深海捞金 |

Every drink offers ice (normal / less / none) and sweetness (normal / less / none),
free of charge. Prices, names and sold-out status can be changed in **Staff → Menu**.
The server always works out the price itself. It never trusts the price a phone sends.

## Run it

Needs Node.js 22.13 or newer. The database is the SQLite built into Node, so there is nothing else to install.

```bash
npm install
npm run build
STAFF_PIN=2580 npm start        # http://localhost:3000
```

The first start creates `data/capys.db` and the menu. The staff PIN defaults to
`1234` if `STAFF_PIN` isn't set. Change it in **Staff → Settings** after you sign in.

Development with hot reload: `npm run dev` (Vite on :5173, proxies the API on :3000).
Tests: `npm test`.

### Settings (environment variables)

| Variable | Default | |
|---|---|---|
| `PORT` | `3000` | |
| `DB_FILE` | `data/capys.db` | Put this on a persistent disk |
| `STAFF_PIN` | `1234` | Used only when the database is first created |
| `STORE_TZ` | `Asia/Kuala_Lumpur` | Decides when "today" starts for order numbers and reports |
| `TRUST_PROXY` | unset | Set to `true` behind a hosting proxy (Render, Railway, Fly, nginx) |

## Putting it online

Customers order on their own mobile data, so the app has to run on the internet,
not on a laptop in the truck. It needs a host that keeps one Node process running
and has a persistent disk for the database:

- **Render (set up in this repo)**: in the Render dashboard choose *New → Blueprint*,
  connect `bryanhoo108/kayutest`, pick the branch that contains `render.yaml`, enter a
  `STAFF_PIN`, and press *Apply*. That creates a free test instance in Singapore. The free
  plan has no persistent disk, so orders reset whenever the instance restarts or sleeps
  (after 15 idle minutes). For real use, switch to the paid *Starter* plan and add the disk
  shown in `render.yaml`.
- **Railway / Fly.io**: deploy this folder with the included `Dockerfile`,
  attach a volume at `/app/data`, and set `STAFF_PIN`.
- Any VPS: `docker build -t capys . && docker run -d -p 3000:3000 -v capys-data:/app/data -e STAFF_PIN=2580 capys`.

Serverless hosts like Vercel or Netlify won't work as they are. Live updates need
a connection that stays open, and the database needs a disk that persists.

After it's online, open **Staff → Settings**, check the ordering address, and
press **Print QR poster** (A4).

## On the truck

- The barista station works on a phone or tablet. Sign in at `/staff` and leave
  **Orders** open. Tap the screen once so the browser is allowed to play the new-order chime.
- Tap **Accepting orders** in the top bar to pause phone orders when you're
  swamped or closing. Walk-up orders still work.
- **Collect & pay** on a ready order opens the payment screen: choose cash (it
  works out the change), DuitNow QR or card. Customers pay at the truck. No
  online payment is taken.
- Receipts and bar tickets print through the browser's print dialog. For an 80 mm
  thermal printer, set the paper width to 80 mm and the margins to none.
- Order numbers start again at #001 each day.

## How it's built

- `server/`: Express API, SQLite (`node:sqlite`), Server-Sent Events for live updates,
  and a signed httpOnly cookie for the staff session. PIN guesses are rate-limited.
- `web/`: React + Vite. `web/src/customer` (ordering), `web/src/staff` (barista station),
  `web/src/display` (pickup screen). The drink pictures are drawn in SVG
  (`components/DrinkArt.jsx`) so they stay sharp and load fast.
- `web/public/logo.svg`: the redrawn logo, with its rounded font embedded.
