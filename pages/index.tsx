import { signIn, signOut, useSession } from "next-auth/react"

export default function Home() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return <p className="p-8">Loading...</p>
  }

  if (!session) {
    return (
      <main className="p-8 max-w-xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Welcome to A11Y Pulse</h1>
        <p className="mb-4">Please sign in to continue.</p>
        <button
          onClick={() => signIn()}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Sign in with GitHub or Google
        </button>
      </main>
    )
  }

  return (
    <main className="p-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Hello, {session.user?.name || session.user?.email} 👋</h1>
      <p>You are logged in.</p>
      <button
        onClick={() => signOut()}
        className="mt-4 px-4 py-2 bg-red-500 text-white rounded"
      >
        Sign Out
      </button>
    </main>
  )
}
