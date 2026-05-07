import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

type MobileTopBarProps = {
  title: string;
  backTo?: string;
  backLabel?: string;
  backState?: unknown;
  rightSlot?: ReactNode;
};

export default function MobileTopBar({
  title,
  backTo = '/',
  backLabel = '뒤로',
  backState,
  rightSlot
}: MobileTopBarProps) {
  return (
    <header className="mobile-topbar">
      <Link to={backTo} state={backState} className="mobile-topbar-back">
        <ChevronLeft size={18} />
        <span>{backLabel}</span>
      </Link>

      <strong>{title}</strong>

      <div className="mobile-topbar-right">{rightSlot}</div>
    </header>
  );
}
