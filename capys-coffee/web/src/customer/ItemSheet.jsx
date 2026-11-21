import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import DrinkArt from '../components/DrinkArt.jsx';
import { Sheet, Stepper } from '../components/ui.jsx';
import { rm } from '../lib/format.js';
import { useShop } from './store.jsx';

/** Item detail + customisation. Pass `line` to edit an existing cart line. */
export default function ItemSheet({ item, line, open, onClose, onDone }) {
  const { menu, t, name, altName, addLine, updateLine, removeLine } = useShop();
  const groups = (menu?.optionGroups || []).filter((g) => item?.options.includes(g.id));
  const defaults = () => Object.fromEntries(groups.map((g) => [g.id, g.default]));

  const [qty, setQty] = useState(1);
  const [options, setOptions] = useState({});
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open || !item) return;
    setQty(line?.qty ?? 1);
    setOptions({ ...defaults(), ...(line?.options || {}) });
    setNote(line?.note ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id, line?.key]);

  if (!item) return <Sheet open={false} onClose={onClose} />;

  const submit = () => {
    const payload = { itemId: item.id, qty, options, note: note.trim() };
    if (line) updateLine(line.key, payload);
    else addLine(payload);
    onDone?.(item, qty, !!line);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} label={name(item)} size="lg" className="item-sheet">
      <div className="item-hero" style={{ background: item.art.tint }}>
        <button type="button" className="icon-btn icon-btn-float" onClick={onClose} aria-label="Close"><X size={20} /></button>
        <DrinkArt art={item.art} size={150} title={item.name} />
      </div>
      <div className="sheet-body item-body">
        <div className="item-title">
          <div>
            {item.number && <span className="item-no">{String(item.number).padStart(2, '0')}</span>}
            <h2>{name(item)}</h2>
            <p className="alt-name">{altName(item)}</p>
          </div>
          <div className="item-price">{rm(item.price)}</div>
        </div>
        {item.tagline && <span className="tag">{name(item, 'tagline')}</span>}
        <p className="item-desc">{name(item, 'description')}</p>

        {groups.map((g) => (
          <fieldset key={g.id} className="opt-group">
            <legend>{name(g)}</legend>
            <div className="opt-choices">
              {g.choices.map((c) => (
                <label key={c.id} className={`opt-chip ${options[g.id] === c.id ? 'is-active' : ''}`}>
                  <input type="radio" name={`opt-${g.id}`} value={c.id} checked={options[g.id] === c.id}
                    onChange={() => setOptions((o) => ({ ...o, [g.id]: c.id }))} />
                  {name(c)}
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        <label className="field">
          <span className="field-label">{t.note} <em>{t.optional}</em></span>
          <textarea rows={2} maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.notePh} />
        </label>
      </div>
      <div className="sheet-footer item-footer">
        <Stepper value={qty} onChange={setQty} />
        <button type="button" className="btn btn-primary btn-lg grow" onClick={submit} disabled={!item.available}>
          {item.available ? <>{line ? t.update : t.addToCart} · {rm(item.price * qty)}</> : t.soldOut}
        </button>
      </div>
      {line && (
        <button type="button" className="link-danger remove-line" onClick={() => { removeLine(line.key); onClose(); }}>{t.remove}</button>
      )}
    </Sheet>
  );
}
