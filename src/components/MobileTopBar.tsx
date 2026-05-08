import type { ReactNode } from 'react';
import { User } from 'lucide-react';
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
    <header className="mobile-topbar">
      <Link to="/" className="mobile-topbar-brand" aria-label="운월당 홈">
        운월당
      </Link>

      <div className="mobile-topbar-spacer" />

      <div className="mobile-topbar-right">
        {rightSlot || (
          <Link to="/my" className="app-profile-button" aria-label="마이페이지">
            <User size={17} strokeWidth={2.2} />
          </Link>
        )}
      </div>
    </header>
  );
}
