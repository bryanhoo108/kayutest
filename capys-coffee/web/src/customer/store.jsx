import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { load, save } from '../lib/storage.js';
import { useLive } from '../lib/useLive.js';

const STR = {
  en: {
    open: 'Open now', closed: 'Closed', dineIn: 'Dine-in', takeaway: 'Takeaway', table: 'Table',
    signature: 'Signature', from: 'from', add: 'Add', soldOut: 'Sold out', viewCart: 'View cart',
    items: (n) => `${n} item${n === 1 ? '' : 's'}`, addToCart: 'Add to cart', update: 'Update', remove: 'Remove',
    note: 'Special request', notePh: 'e.g. less milk, separate cup…', optional: 'Optional',
    yourOrder: 'Your order', checkout: 'Checkout', orderType: 'How will you enjoy it?', yourName: 'Your name',
    namePh: 'So we can call you when it’s ready', orderNote: 'Note for the barista',
    orderNotePh: 'Anything else we should know?', payment: 'Payment', payAtCounter: 'Pay at the truck',
    payAtCounterSub: 'Cash, card or DuitNow QR. Show your order number when you pay.', total: 'Total', placeOrder: 'Place order',
    emptyCart: 'Your cart is empty', emptyCartSub: 'Pick something delicious from the menu.', browseMenu: 'Browse menu',
    closedBanner: 'We’re not taking orders right now. Please check back soon!', myOrders: 'My orders', orderMore: 'Order more',
    received: 'Order received', receivedSub: 'Waiting for the barista to accept', preparing: 'Preparing', preparingSub: 'Your drinks are being made',
    ready: 'Ready for pickup!', readySub: 'Collect your drinks at the truck', collected: 'Collected', collectedSub: 'Enjoy your drinks ☕',
    cancelled: 'Order cancelled', cancelledSub: 'Please speak to our staff if this is unexpected.',
    payNow: (amt) => `Please pay ${amt} at the truck`, paid: 'Paid', live: 'Live', reconnecting: 'Reconnecting…',
    orderNumber: 'Order number', showNumber: 'Show this number when you pay', edit: 'Edit', back: 'Back',
    required: 'Required', nameRequired: 'Please enter your name', tableRequired: 'Please enter your table number',
    noActive: 'No orders yet today', thanks: 'Thank you!', everySip: 'Every sip, a good mood', viewOrder: 'View',
    signatureTag: 'Signature', tapToCustomise: 'Customise', notifyReady: 'Keep this page open — we’ll chime when it’s ready.',
    step1: 'Order here', step2: 'Pay at the truck', step3: 'We’ll call your name',
  },
  zh: {
    open: '营业中', closed: '休息中', dineIn: '堂食', takeaway: '外带', table: '桌号',
    signature: '招牌', from: '起', add: '加入', soldOut: '已售罄', viewCart: '查看购物车',
    items: (n) => `${n} 杯`, addToCart: '加入购物车', update: '更新', remove: '移除',
    note: '特别要求', notePh: '例如：少奶、分开装…', optional: '选填',
    yourOrder: '我的订单', checkout: '结账', orderType: '用餐方式', yourName: '您的名字',
    namePh: '饮品做好时方便叫您', orderNote: '给咖啡师的备注',
    orderNotePh: '还有其他需要吗？', payment: '付款方式', payAtCounter: '到车前付款',
    payAtCounterSub: '现金、刷卡或 DuitNow QR。付款时请出示订单号。', total: '合计', placeOrder: '确认下单',
    emptyCart: '购物车是空的', emptyCartSub: '去菜单挑一杯好喝的吧。', browseMenu: '浏览菜单',
    closedBanner: '目前暂停接单，请稍后再来！', myOrders: '我的订单', orderMore: '继续点单',
    received: '已收到订单', receivedSub: '等待咖啡师接单', preparing: '制作中', preparingSub: '您的饮品正在制作',
    ready: '可以取餐啦！', readySub: '请到车前取餐', collected: '已取餐', collectedSub: '祝您喝得开心 ☕',
    cancelled: '订单已取消', cancelledSub: '如有疑问请联系店员。',
    payNow: (amt) => `请到车前付款 ${amt}`, paid: '已付款', live: '实时', reconnecting: '重新连接中…',
    orderNumber: '订单号', showNumber: '付款时请出示此号码', edit: '修改', back: '返回',
    required: '必填', nameRequired: '请输入您的名字', tableRequired: '请输入桌号',
    noActive: '今天还没有订单', thanks: '谢谢光临！', everySip: '每一口，都是好心情', viewOrder: '查看',
    signatureTag: '招牌', tapToCustomise: '自定义', notifyReady: '请保持此页面开启，做好时会提示您。',
    step1: '手机点单', step2: '到车前付款', step3: '做好叫您取'
  },
};

const Ctx = createContext(null);
export const useShop = () => useContext(Ctx);

const sameOptions = (a = {}, b = {}) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if (a[k] !== b[k]) return false;
  return true;
};

export function ShopProvider({ children }) {
  const [menu, setMenu] = useState(null);
  const [error, setError] = useState(null);
  const [lang, setLang] = useState(() => load('capys.lang', 'en'));
  const [cart, setCart] = useState(() => load('capys.cart', []));
  // Remembered customer details (just the name — every order is takeaway from the truck).
  const [ctx, setCtx] = useState(() => ({ name: load('capys.ctx', {}).name || '' }));
  const [orders, setOrders] = useState(() => {
    const cutoff = Date.now() - 18 * 3600_000;
    return load('capys.orders', []).filter((o) => o.createdAt > cutoff);
  });

  useEffect(() => save('capys.lang', lang), [lang]);
  useEffect(() => save('capys.cart', cart), [cart]);
  useEffect(() => save('capys.ctx', ctx), [ctx]);
  useEffect(() => save('capys.orders', orders), [orders]);
  useEffect(() => { document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : 'en'; }, [lang]);

  const fetchMenu = useCallback(() => {
    api.get('/api/menu').then((m) => { setMenu(m); setError(null); }).catch((e) => setError(e.message));
  }, []);
  useEffect(fetchMenu, [fetchMenu]);

  const tokens = orders.map((o) => o.token).join(',');
  const [orderUpdates, setOrderUpdates] = useState({});
  const live = useLive(`/api/stream?orders=${encodeURIComponent(tokens)}`, {
    menu: (m) => setMenu(m),
    order: (o) => setOrderUpdates((u) => ({ ...u, [o.token]: o })),
  }, fetchMenu);

  const items = useMemo(() => new Map((menu?.items || []).map((i) => [i.id, i])), [menu]);

  // Drop cart lines whose item disappeared from the menu.
  useEffect(() => {
    if (!menu) return;
    setCart((c) => {
      const next = c.filter((l) => items.has(l.itemId));
      return next.length === c.length ? c : next;
    });
  }, [menu, items]);

  const addLine = useCallback((line) => {
    setCart((c) => {
      const i = c.findIndex((l) => l.itemId === line.itemId && sameOptions(l.options, line.options) && (l.note || '') === (line.note || ''));
      if (i >= 0) {
        const next = [...c];
        next[i] = { ...next[i], qty: Math.min(50, next[i].qty + line.qty) };
        return next;
      }
      return [...c, { ...line, key: Math.random().toString(36).slice(2) }];
    });
  }, []);
  const updateLine = useCallback((key, patch) => setCart((c) => c.map((l) => (l.key === key ? { ...l, ...patch } : l))), []);
  const removeLine = useCallback((key) => setCart((c) => c.filter((l) => l.key !== key)), []);
  const clearCart = useCallback(() => setCart([]), []);

  const lines = cart.map((l) => ({ ...l, item: items.get(l.itemId) })).filter((l) => l.item);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const total = lines.reduce((s, l) => s + l.qty * l.item.price, 0);
  const unavailable = lines.filter((l) => !l.item.available);

  const rememberOrder = useCallback((o) => {
    const entry = { token: o.token, number: o.number, createdAt: o.createdAt, total: o.total };
    setOrders((list) => {
      const i = list.findIndex((x) => x.token === o.token);
      if (i >= 0) {
        const cur = list[i];
        if (cur.number === entry.number && cur.total === entry.total && cur.createdAt === entry.createdAt) return list;
        const next = [...list];
        next[i] = entry;
        return next;
      }
      return [entry, ...list].slice(0, 10);
    });
  }, []);

  const t = STR[lang];
  const name = (obj, key = 'name') => (lang === 'zh' && obj[`${key}Zh`]) || obj[key];
  const altName = (obj, key = 'name') => (lang === 'zh' ? obj[key] : obj[`${key}Zh`]);

  const value = {
    menu, error, retry: fetchMenu, live, lang, setLang, t, name, altName,
    cart: lines, count, total, unavailable, addLine, updateLine, removeLine, clearCart,
    ctx, setCtx, orders, rememberOrder, orderUpdates,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
