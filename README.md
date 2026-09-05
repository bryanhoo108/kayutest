# Kayu & Co. operations app

A single-file operations dashboard built from one spreadsheet. Open
[`kayu-operations.html`](kayu-operations.html) in any browser — with Wi-Fi off if you
like. No server, no build step to view it, no external scripts, no external fonts, no
network calls of any kind. The 483 data rows are embedded in the file as JSON.

Kayu & Co. Furniture Sdn Bhd is a **fictional** company from a training workbook. Every
number here is invented.

## What's in it

| Page | What it does |
|---|---|
| Overview | The three numbers, each with a source line saying which column and rows it came from, plus the top four cards |
| Needs attention | All 42 cards, highest severity first, and a panel printing the nine rules that generated them |
| Revenue | Filters, revenue stacked by channel, category lines, monthly table with drill-down |
| Receivables | 40 dealers, credit-limit usage bars, aging by bucket, click a dealer for its invoices |
| Cash | Closing balance, receipts by source, the twelve rows with net movement |
| Costs | Spike detection against a rolling three-month average, drawn on the chart |
| Marketing | Cost per lead and CTR by campaign, weekly, with per-week drill-down |
| Posts | 48 organic posts, engagement rate, per-post breakdown |
| The plan | The rebuild instructions, embedded from `dashboard-plan.txt` |

### The three numbers

| | Value | Where it comes from |
|---|---|---|
| Cash closing balance | RM 1,510,000 | `cash.csv`, closing balance, row `2026-08` — one cell |
| Receivables past 60 days | RM 487,900 | `ar-aging.csv`, sum of amount where days overdue > 60 (7 invoices, 5 dealers) |
| Office revenue vs 3 months ago | +37.7% | `revenue.csv`, category = Office: RM 327,900 in Aug vs RM 238,200 in May |

Each is printed on the page with its own source line so you can add it up by hand.

## Three things the data does that a dashboard usually gets wrong

1. **A blank is not a zero.** Shah Alam Home Depot has no credit limit in the sheet. It is
   carried as *unknown*, shown as such, and can never trigger the over-limit rule. It gets
   its own data-quality card instead.
2. **A credit note is negative.** `INV-261462` is −RM 4,800. It nets into the dealer's
   balance and into the Current bucket. Summing the bucket without it overstates
   receivables by RM 4,800.
3. **A disputed invoice is two things at once.** `INV-261416` (RM 187,400) is excluded
   from the chase rules but still counts against the dealer's credit limit, which is what
   the credit terms actually say. It gets a card telling a human to call.

## The queue rules

Every card comes from a rule you can state in one line, and all nine are printed on the
page itself with their source. Seven come from the business's written credit terms
(the chase sequence: statement at 1–7 days, chase email at 8–30, shipments held at 31–60,
owner meeting at 61–90, director letter past 90). Two are marked **DEFAULT** because no
threshold for them exists in any document — a cost more than 25% above its prior
three-month average, and a revenue category up more than 25% over two months. If your
business has real thresholds for those, change them in `build/app.template.html` and say
so on the page.

Current build: 42 cards — 12 high, 12 medium, 17 low, 1 good.

## Rebuilding

```
python build/build_dashboard.py
```

Standard library only, Python 3.8+. It reads the six CSVs in `data/`, embeds them in
`build/app.template.html`, and writes `kayu-operations.html` plus an `index.html` copy for
GitHub Pages. Same CSVs in, byte-identical HTML out.

To refresh with new figures: replace the CSVs in `data/`, run the script, commit. Then
check the three numbers against the source by hand before you trust the page — that check
is the whole point, and [`dashboard-plan.txt`](dashboard-plan.txt) walks someone who was
not there through it.

## Layout

```
data/                    six CSVs — the sheet, one file per tab
build/app.template.html  the page: markup, CSS, charts, rules, router
build/build_dashboard.py reads the CSVs, embeds them, writes the page
dashboard-plan.txt       what was decided and how to rebuild it
kayu-operations.html     the app  (generated — edit the template, not this)
index.html               identical copy, for GitHub Pages (generated)
```

`dashboard-plan.txt` is the real deliverable. The page can be rebuilt from it by someone
who has never seen this repo.

## What it never does

No fetch, no external script, no external font, no login, no send. Every button either
navigates within the page, copies a prompt to your clipboard, or ticks a box stored in
that browser's `localStorage`. Nothing leaves the machine, which also means the "handled"
ticks are per-browser and are not shared between people.

It is a snapshot of one upload. Nothing updates on its own.
