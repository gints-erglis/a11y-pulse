import Link from "next/link"
import Image from "next/image"
import { signIn, signOut, useSession } from "next-auth/react"
import UserMenu from './UserMenu';

export default function Header() {
  const { data: session, status } = useSession()

  return (
    <header className="header full-width">
      <div className="wrapper header__content">
        <Link href="/" className="logo">
          <Image
            src="/a11y-logo.svg"
            alt="A11Y Pulse Logo"
            width={32}
            height={32}
          />
          <span className="visually-hidden">A11Y Pulse</span>
        </Link>
        <nav className="menu menu--main">
          {session && (
            <Link href="/sites" className="hover:underline">
              Sites
            </Link>
          )}
          <Link href="/about" className="hover:underline">About</Link>
        </nav>
        {!session ? (
          <button
            onClick={() => signIn()}
            className="button button--primary"
          >
            Sign in
          </button>
        ) : (
          <UserMenu />
        )}
      </div>
    </header>
  )
}
