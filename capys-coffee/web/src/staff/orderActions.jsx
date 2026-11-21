import { useState } from 'react';
import { Confirm } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { orderNo, rm } from '../lib/format.js';
import { printOrder } from '../lib/print.js';
import PaymentDialog from './PaymentDialog.jsx';
import { useStaff } from './StaffApp.jsx';

const CANCEL_REASONS = ['Customer changed mind', 'Item sold out', 'Duplicate order', 'Customer did not pay', 'Wrong order'];

/** Shared order actions + their dialogs, used by the order board, history and counter. */
export function useOrderActions() {
  const { act, menu } = useStaff();
  const [paying, setPaying] = useState(null); // { order, then: 'complete' | null }
  const [cancelling, setCancelling] = useState(null);
  const [reason, setReason] = useState('');
  const [voiding, setVoiding] = useState(null);
  const [busy, setBusy] = useState(false);

  const status = (o, s, msg) => act(() => api.post(`/api/staff/orders/${o.id}/status`, { status: s }), msg);

  const actions = {
    start: (o) => status(o, 'preparing'),
    ready: (o) => status(o, 'ready', `${orderNo(o.number)} is ready`),
    complete: (o) => {
      if (o.paymentStatus !== 'paid') { setPaying({ order: o, then: 'complete' }); return; }
      status(o, 'completed', `${orderNo(o.number)} collected`);
    },
    back: (o) => {
      const prev = { preparing: 'new', ready: 'preparing', completed: 'ready' }[o.status];
      if (prev) status(o, prev, `${orderNo(o.number)} moved back`);
    },
    recall: (o) => status(o, 'ready', `${orderNo(o.number)} recalled`),
    pay: (o) => setPaying({ order: o, then: null }),
    cancel: (o) => { setReason(''); setCancelling(o); },
    voidPayment: (o) => setVoiding(o),
    toggleLine: (o, line) => act(() => api.post(`/api/staff/orders/${o.id}/lines/${line.id}`, { done: !line.done })),
    print: (o, kind = 'receipt') => printOrder(o, { kind, storeName: menu?.store.name, timeZone: menu?.store.timeZone }),
  };

  const doPay = async (payment) => {
    const { order, then } = paying;
    const paid = await act(() => api.post(`/api/staff/orders/${order.id}/pay`, payment),
      then === 'complete' ? null : `${orderNo(order.number)} paid`);
    if (!paid) return;
    if (then === 'complete') await status(paid, 'completed', `${orderNo(order.number)} paid & collected`);
    setPaying(null);
  };

  const doCancel = async () => {
    setBusy(true);
    const o = await act(() => api.post(`/api/staff/orders/${cancelling.id}/status`, { status: 'cancelled', reason }), `${orderNo(cancelling.number)} cancelled`);
    setBusy(false);
    if (o) setCancelling(null);
  };

  const doVoid = async () => {
    setBusy(true);
    const o = await act(() => api.post(`/api/staff/orders/${voiding.id}/void-payment`), 'Payment voided');
    setBusy(false);
    if (o) setVoiding(null);
  };

  const dialogs = (
    <>
      <PaymentDialog
        open={!!paying}
        onClose={() => setPaying(null)}
        total={paying?.order.total || 0}
        title={paying ? `Payment for ${orderNo(paying.order.number)}` : 'Payment'}
        subtitle={paying?.order.customerName || undefined}
        confirmLabel={paying?.then === 'complete' ? 'Paid · Mark collected' : 'Confirm payment'}
        onPay={doPay}
        extraAction={paying?.then === 'complete' ? (
          <button type="button" className="btn btn-ghost" onClick={async () => {
            const o = paying.order;
            setPaying(null);
            await status(o, 'completed', `${orderNo(o.number)} collected (unpaid)`);
          }}>Collected, unpaid</button>
        ) : null}
      />
      <Confirm
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        title={cancelling ? `Cancel ${orderNo(cancelling.number)}?` : 'Cancel order'}
        body={cancelling?.paymentStatus === 'paid' ? `This order was paid (${rm(cancelling.total)}). Cancelling marks it as refunded — remember to return the money.` : 'The customer will see that the order was cancelled.'}
        confirmLabel="Cancel order"
        tone="danger"
        busy={busy}
        onConfirm={doCancel}
      >
        <div className="reason-chips">
          {CANCEL_REASONS.map((r) => (
            <button key={r} type="button" className={reason === r ? 'is-active' : ''} onClick={() => setReason(r)}>{r}</button>
          ))}
        </div>
        <input className="input" placeholder="Or type a reason (shown to the customer)" maxLength={120} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Confirm>
      <Confirm
        open={!!voiding}
        onClose={() => setVoiding(null)}
        title="Void this payment?"
        body={voiding ? `${orderNo(voiding.number)} will go back to unpaid (${rm(voiding.total)}). Use this if the payment was recorded by mistake.` : ''}
        confirmLabel="Void payment"
        tone="danger"
        busy={busy}
        onConfirm={doVoid}
      />
    </>
  );

  return { actions, dialogs };
}
