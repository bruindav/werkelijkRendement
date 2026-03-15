// Herbruikbaar drag & drop component voor gesorteerde lijsten
// Gebruikt HTML5 drag API — geen externe dependencies
import { useState, useRef } from 'react';
import { GripVertical } from 'lucide-react';

/**
 * DragLijst — wikkelt een lijst in met sleepbare volgorde.
 * 
 * Props:
 *   items        — array van objecten met minimaal { id }
 *   onVolgorde   — callback(nieuweVolgorde) als volgorde wijzigt
 *   renderItem   — function(item, dragHandleProps) → JSX
 */
export default function DragLijst({ items, onVolgorde, renderItem }) {
  const [dragOver, setDragOver] = useState(null); // id van item waar over gesleept wordt
  const dragItem = useRef(null); // id van item dat gesleept wordt

  const handleDragStart = (e, id) => {
    dragItem.current = id;
    e.dataTransfer.effectAllowed = 'move';
    // Lichte vertraging zodat de drag-image correct is
    setTimeout(() => e.target.closest('[data-drag-item]')?.classList.add('opacity-50'), 0);
  };

  const handleDragEnd = (e) => {
    e.target.closest('[data-drag-item]')?.classList.remove('opacity-50');
    dragItem.current = null;
    setDragOver(null);
  };

  const handleDragOver = (e, id) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== dragItem.current) setDragOver(id);
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    if (!dragItem.current || dragItem.current === targetId) return;

    const van = items.findIndex(i => i.id === dragItem.current);
    const naar = items.findIndex(i => i.id === targetId);
    if (van === -1 || naar === -1) return;

    const nieuw = [...items];
    const [verplaatst] = nieuw.splice(van, 1);
    nieuw.splice(naar, 0, verplaatst);
    onVolgorde(nieuw);
    setDragOver(null);
  };

  return (
    <div className="space-y-2">
      {items.map(item => (
        <div
          key={item.id}
          data-drag-item
          draggable
          onDragStart={e => handleDragStart(e, item.id)}
          onDragEnd={handleDragEnd}
          onDragOver={e => handleDragOver(e, item.id)}
          onDrop={e => handleDrop(e, item.id)}
          className={`transition-all ${
            dragOver === item.id
              ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950 rounded-2xl'
              : ''
          }`}
        >
          {renderItem(item, {
            // dragHandleProps: geef dit mee aan het handvat element
            onMouseDown: (e) => e.currentTarget.closest('[data-drag-item]')?.setAttribute('draggable', true),
            className: 'cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300 transition-colors p-1',
            title: 'Slepen om te sorteren',
          })}
        </div>
      ))}
    </div>
  );
}

// Handvat icoon — gebruik dit in de renderItem callback
export function DragHandle({ dragHandleProps }) {
  return (
    <div {...dragHandleProps}>
      <GripVertical className="w-4 h-4" />
    </div>
  );
}
