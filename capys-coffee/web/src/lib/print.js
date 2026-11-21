import { orderNo, rm, PAYMENT_LABEL } from './format.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Print an 80 mm receipt (for the customer) or a drink ticket (for the bar).
 * Uses the browser print dialog; on a thermal printer set paper width to 80 mm and margins to none.
 */
export function printOrder(order, { kind = 'receipt', storeName = "Capy's Coffee", timeZone } = {}) {
  const root = document.getElementById('print-root');
  if (!root) return;
  const when = new Date(order.createdAt).toLocaleString('en-MY', { timeZone, day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const lines = order.items.map((l) => {
    const opts = (kind === 'ticket' ? l.options.filter((o) => !o.isDefault) : l.options).map((o) => esc(o.name)).join(' · ');
    return `
      <tr><td class="q">${l.qty}×</td><td class="n">${esc(l.name)}${l.nameZh ? `<div class="zh">${esc(l.nameZh)}</div>` : ''}${opts ? `<div class="o">${opts}</div>` : ''}${l.note ? `<div class="o">“${esc(l.note)}”</div>` : ''}</td>${kind === 'receipt' ? `<td class="p">${rm(l.lineTotal)}</td>` : ''}</tr>`;
  }).join('');

  const pay = order.paymentStatus === 'paid'
    ? `PAID · ${esc(PAYMENT_LABEL[order.paymentMethod] || '')}${order.cashReceived ? `<br>Cash ${rm(order.cashReceived)} · Change ${rm(order.cashReceived - order.total)}` : ''}`
    : order.paymentStatus === 'refunded' ? 'REFUNDED' : 'UNPAID';

  root.innerHTML = `
    <div class="receipt">
      ${kind === 'receipt' ? `<img src="/logo.svg" alt="" class="r-logo"><div class="r-store">${esc(storeName)}</div>` : '<div class="r-store">BAR TICKET</div>'}
      <div class="r-no">${orderNo(order.number)}</div>
      ${order.customerName ? `<div class="r-name">${esc(order.customerName)}</div>` : ''}
      <div class="r-meta">${esc(when)}</div>
      <hr>
      <table>${lines}</table>
      ${order.note ? `<hr><div class="r-note">Note: ${esc(order.note)}</div>` : ''}
      ${kind === 'receipt' ? `<hr><div class="r-total"><span>TOTAL</span><span>${rm(order.total)}</span></div><div class="r-pay">${pay}</div><hr><div class="r-thanks">Thank you for choosing Capy's Coffee!<br>每一口，都是好心情</div>` : ''}
    </div>`;
  const img = root.querySelector('img');
  const go = () => setTimeout(() => window.print(), 50);
  if (img && !img.complete) { img.onload = go; img.onerror = go; } else go();
}
