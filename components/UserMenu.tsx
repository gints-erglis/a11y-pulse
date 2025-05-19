import { useState, useRef, useEffect } from 'react';
import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';

export default function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const toggleMenu = () => setOpen((prev) => !prev);

  const handleClickOutside = (event: MouseEvent) => {
    if (
      menuRef.current &&
      !menuRef.current.contains(event.target as Node) &&
      buttonRef.current &&
      !buttonRef.current.contains(event.target as Node)
    ) {
      setOpen(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      setOpen(false);
      buttonRef.current?.focus();
    }
  };

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (!session?.user) return null;

  return (
    <div className="user-menu--wrapper">
      <button
        ref={buttonRef}
        onClick={toggleMenu}
        className="user-menu--trigger"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="user-menu"
      >
        <img
          src={session.user.image || '/avatar.jpg'}
          alt="User avatar"
          className="avatar"
        />
      </button>

      {open && (
        <div
          ref={menuRef}
          id="user-menu"
          role="menu"
          aria-label="User menu"
          className="user-menu--popover"
        >
          <span className="user-menu--username">{session.user?.name || session.user?.email}</span>
          <Link
            href="/user"
            role="menuitem"
            className="button button--user-menu"
          >
            Account Settings
          </Link>
          <button
            onClick={() => signOut()}
            role="menuitem"
            className="button button--user-menu"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}