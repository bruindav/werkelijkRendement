// Herbruikbare Breadcrumb component
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export default function Breadcrumb({ items }) {
  // items = [{ label, to }, { label, to }, { label }]  (laatste heeft geen to)
  return (
    <nav className="flex items-center gap-1 text-sm mb-6 flex-wrap">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />}
            {isLast || !item.to ? (
              <span className={isLast ? 'text-white font-medium' : 'text-slate-500'}>{item.label}</span>
            ) : (
              <Link to={item.to} className="text-slate-400 hover:text-white transition-colors">
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
