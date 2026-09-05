"""Build the Kayu & Co. operations app from the CSVs in data/.

    python build/build_dashboard.py

Deterministic: the same CSVs in, byte-identical HTML out. Writes two copies of the
same page — kayu-operations.html (the name the plan file tells you to keep, so Monday's
rebuild replaces the old one) and index.html (what GitHub Pages serves).

No dependencies beyond the standard library. Python 3.8+.
"""
import csv, json, os, shutil, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
TEMPLATE = os.path.join(ROOT, "build", "app.template.html")
PLAN = os.path.join(ROOT, "dashboard-plan.txt")
OUT = os.path.join(ROOT, "kayu-operations.html")
PAGES_COPY = os.path.join(ROOT, "index.html")


def rd(name):
    with open(os.path.join(DATA, name), encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def num(s, default=None):
    """Blank stays blank. A blank credit limit means unknown, never zero."""
    s = (s or "").strip()
    return default if s == "" else float(s)


def load():
    revenue = [{"m": r["Month"], "ch": r["Channel"], "cat": r["Category"],
                "u": int(num(r["Units"], 0)), "rev": num(r["Revenue (RM)"], 0)}
               for r in rd("revenue.csv")]

    costs = [{"m": r["Month"], "cat": r["Cost category"], "amt": num(r["Amount (RM)"], 0)}
             for r in rd("costs.csv")]

    ar = [{"dealer": r["Dealer"], "region": r["Region"],
           "terms": int(num(r["Terms (days)"], 30)),
           "limit": num(r["Credit limit (RM)"], None),
           "inv": r["Invoice no"], "idate": r["Invoice date"], "ddate": r["Due date"],
           "amt": num(r["Amount (RM)"], 0),
           "days": int(num(r["Days overdue (as at 2026-08-31)"], 0)),
           "bucket": r["Bucket"], "contact": r["Last contact"].strip(),
           "note": r["Note"].strip()}
          for r in rd("ar-aging.csv")]

    cash = [{"m": r["Month"], "open": num(r["Opening balance (RM)"], 0),
             "rd": num(r["Receipts from dealers (RM)"], 0),
             "rs": num(r["Receipts showroom and online (RM)"], 0),
             "sup": num(r["Payments to suppliers (RM)"], 0),
             "pay": num(r["Payroll (RM)"], 0), "oth": num(r["Other payments (RM)"], 0),
             "close": num(r["Closing balance (RM)"], 0)}
            for r in rd("cash.csv")]

    ads = [{"w": r["Week starting"], "camp": r["Campaign"], "plat": r["Platform"],
            "spend": num(r["Spend (RM)"], 0), "imp": int(num(r["Impressions"], 0)),
            "clicks": int(num(r["Clicks"], 0)), "leads": int(num(r["Leads"], 0)),
            "ctr": num(r["CTR (%)"], 0), "cpl": num(r["Cost per lead (RM)"], 0)}
           for r in rd("ads.csv")]

    posts = [{"d": r["Date"], "plat": r["Platform"], "fmt": r["Format"], "hook": r["Hook"],
              "reach": int(num(r["Reach"], 0)), "likes": int(num(r["Likes"], 0)),
              "comments": int(num(r["Comments"], 0)), "saves": int(num(r["Saves"], 0)),
              "shares": int(num(r["Shares"], 0)), "clicks": int(num(r["Link clicks"], 0))}
             for r in rd("posts.csv")]

    return {"revenue": revenue, "costs": costs, "ar": ar, "cash": cash, "ads": ads,
            "posts": posts,
            "meta": {"built": datetime.date.today().isoformat(),
                     "asat": "2026-08-31",
                     "source": "demo-workbook.xlsx (Revenue, Costs, AR aging, Cash, Ads, Posts)"}}


def main():
    data = load()
    plan = ""
    if os.path.exists(PLAN):
        with open(PLAN, encoding="utf-8") as f:
            plan = f.read()

    with open(TEMPLATE, encoding="utf-8") as f:
        html = f.read()

    html = html.replace("/*__DATA__*/null",
                        json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    html = html.replace("__PLANTEXT__", plan.replace("&", "&amp;").replace("<", "&lt;"))

    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(html)
    shutil.copyfile(OUT, PAGES_COPY)

    rows = sum(len(data[k]) for k in ("revenue", "costs", "ar", "cash", "ads", "posts"))
    print("wrote %s (%d bytes, %d rows embedded)" % (OUT, os.path.getsize(OUT), rows))
    print("wrote %s (copy for GitHub Pages)" % PAGES_COPY)


if __name__ == "__main__":
    main()
