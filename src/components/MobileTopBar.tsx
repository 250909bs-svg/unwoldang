import type { ReactNode } from 'react';
import { Menu } from 'lucide-react';
import { Link } from 'react-router-dom';

type MobileTopBarProps = {
  title: string;
  backTo?: string;
  backLabel?: string;
  backState?: unknown;
  rightSlot?: ReactNode;
};

export default function MobileTopBar({ rightSlot }: MobileTopBarProps) {
  return (
    <header className="mobile-topbar primary-topbar">
      <Link to="/" className="mobile-topbar-brand" aria-label="운월당 홈">
        운월당
      </Link>

      <div className="mobile-topbar-spacer" />

      <div className="mobile-topbar-right">
        {rightSlot || (
          <Link to="/?menu=open" className="app-menu-button primary-topbar-menu" aria-label="전체 메뉴">
            <Menu size={24} strokeWidth={2.2} />
          </Link>
        )}
      </div>
    </header>
  );
}
