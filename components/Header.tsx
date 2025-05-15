import Link from "next/link"
import Image from "next/image"
import { signIn, signOut, useSession } from "next-auth/react"

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
        <nav className="space-x-4">
          <Link href="/dashboard" className="hover:underline">Dashboard</Link>
          <Link href="/about" className="hover:underline">About</Link>
        </nav>
        {!session ? (
          <button
            onClick={() => signIn()}
            className="button button-primary"
          >
            Sign in
          </button>
        ) : (
          <>
            <span className="text-2xl font-bold mb-4">Hello, {session.user?.name || session.user?.email} 👋</span>
            <button
              onClick={() => signOut()}
              className="button button-primary"
            >
              Sign Out
            </button>
          </>

        )}
      </div>
    </header>
  )
}
