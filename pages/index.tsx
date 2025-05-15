import { signIn, signOut, useSession } from "next-auth/react"
import Link from "next/link"

export default function Home() {
  const {data: session, status} = useSession()

  if (status === "loading") {
    return <p className="p-8">Loading...</p>
  }
  return (
    <main className="content">
      <h1 className="text-2xl font-bold mb-4">Welcome to A11Y Pulse</h1>
      {!session ? (
        <p className="mb-4">Please sign in to continue.</p>
      ) : (
        <>
          <p className="mb-2">You are tracking {session.user?.name || session.user?.email}'s websites.</p>
          <Link href="/sites" className="text-blue-600 underline">View Your Sites</Link>
        </>

      )}
    </main>
  )
}
