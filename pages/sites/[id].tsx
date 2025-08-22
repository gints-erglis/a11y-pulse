// pages/sites/[id].tsx
import type { GetServerSideProps, GetServerSidePropsContext } from "next"
import { getServerSession } from "next-auth/next"            // ← pages router gadījumā lieto "next-auth/next"
import { authOptions } from "@/pages/api/auth/[...nextauth]"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/router"
import { apiJson } from "@/lib/api"

type SiteDTO = { id: number; url: string }

type ReportMeta = {
  file: string        // piem. "2025-08-17_12-30-11.pdf"
  href: string        // piem. "/api/reports/3/file/2025-08-17_12-30-11.pdf"
  createdAt: string   // ISO
  size: number        // bytes
}

type ReportsResponse = { reports: ReportMeta[] } | { error: string }

export const getServerSideProps: GetServerSideProps<{ site: SiteDTO }> = async (
  context: GetServerSidePropsContext
) => {
  const session = await getServerSession(context.req, context.res, authOptions)
  const siteId = Number(context.params?.id)

  if (!session?.user?.email || !Number.isInteger(siteId)) {
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
      site: { id: site.id, url: site.url },
    },
  }
}

export default function SitePage({ site }: { site: SiteDTO }) {
  const [reports, setReports] = useState<ReportMeta[]>([])
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const fetchReports = async () => {
    const json = await apiJson<ReportsResponse>(`/api/reports/${site.id}`)
    if ("error" in json) {
      console.error(json.error)
      setReports([])
    } else {
      setReports(json.reports ?? [])
    }
  }

  useEffect(() => {
    void fetchReports()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site.id])

  const handleRunTest = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/sites/${site.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: site.url }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      alert("✅ Test completed!")
      await fetchReports()
    } catch (err: any) {
      alert("❌ Error: " + (err?.message || String(err)))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8">
      <button onClick={() => router.back()} className="mb-4 text-sm underline">
        ← Back
      </button>

      <h1 className="text-2xl font-bold mb-4 break-all">{site.url}</h1>

      <button
        onClick={handleRunTest}
        className="button button--primary mb-6"
        disabled={loading}
      >
        {loading ? "Running Test..." : "Run A11Y Test"}
      </button>

      <h2 className="text-xl font-semibold mb-2">Reports</h2>
      {reports.length === 0 ? (
        <p className="text-gray-500">No reports yet.</p>
      ) : (
        <ul className="space-y-2">
          {reports.map((r) => (
            <li key={r.file} className="flex items-center justify-between gap-4">
              <Link
                href={r.href}            // ← izmanto API sniegto drošo ceļu
                target="_blank"
                className="text-blue-600 underline truncate"
                title={r.file}
              >
                {new Date(r.createdAt).toLocaleString()} — {r.file}
              </Link>
              <span className="text-sm text-gray-500 shrink-0">
                {(r.size / 1024 / 1024).toFixed(2)} MB
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
