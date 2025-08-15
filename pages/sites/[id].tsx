import { getServerSession } from "next-auth"
import { authOptions } from "@/pages/api/auth/[...nextauth]"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/router"

export async function getServerSideProps(context) {
  const session = await getServerSession(context.req, context.res, authOptions)
  const siteId = parseInt(context.params.id)

  if (!session || !session.user?.email) {
    return { redirect: { destination: "/", permanent: false } }
  }

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { owner: true },
  })

  if (!site || site.owner.email !== session.user.email) {
    return { notFound: true }
  }

  return {
    props: {
      site: {
        id: site.id,
        url: site.url,
      },
    },
  }
}

export default function SitePage({ site }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const fetchReports = async () => {
    const res = await fetch(`/api/reports/${site.id}`)
    const json = await res.json()
    setReports(json.reports || [])
  }

  useEffect(() => {
    fetchReports()
  }, [site.id])

  const handleRunTest = async () => {
    setLoading(true)
    const res = await fetch(`/api/sites/${site.id}/test`, {
      method: "POST",
      body: JSON.stringify({ url: site.url }),
      headers: { "Content-Type": "application/json" },
    })
    setLoading(false)
    if (res.ok) {
      alert("✅ Test completed!")
      fetchReports()
    } else {
      const json = await res.json()
      alert("❌ Error: " + json.error)
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">{site.url}</h1>

      <button
        onClick={handleRunTest}
        className="button button--primary mb-4"
        disabled={loading}
      >
        {loading ? "Running Test..." : "Run A11Y Test"}
      </button>

      <h2 className="text-xl font-semibold mb-2">Reports</h2>
      {reports.length === 0 ? (
        <p className="text-gray-500">No reports yet.</p>
      ) : (
        <ul className="space-y-2">
          {reports.map((ts) => (
            <li key={ts}>
              <Link
                href={`/api/reports/${site.id}/${encodeURIComponent(ts)}.pdf`}
                className="text-blue-600 underline"
                target="_blank"
              >
                {new Date(ts).toLocaleString()} Report
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
