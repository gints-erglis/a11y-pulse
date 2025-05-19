import { useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/router"

export default function AddSitePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [url, setUrl] = useState("")
  const [error, setError] = useState("")

  if (status === "loading") return <p>Loading...</p>
  if (!session) {
    router.push("/")
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const res = await fetch("/api/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    })

    if (res.ok) {
      router.push("/sites")
    } else {
      const data = await res.json()
      setError(data.message || "Something went wrong.")
    }
  }

  return (
    <div className="max-w-xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Add a New Site</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          className="w-full border rounded p-2"
          placeholder="https://example.com"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Add Site
        </button>
        {error && <p className="text-red-600">{error}</p>}
      </form>
    </div>
  )
}
