import { useEffect, useState } from "react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/pages/api/auth/[...nextauth]"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import ScoreCircle from "@/components/ScoreCircle"
import { formatDistanceToNow } from "date-fns"

type ReportMeta = {
  file: string
  href: string               // /api/reports/[siteId]/file/[fileName.pdf]
  createdAt: string          // ISO
  size: number
}

type SiteWithLatest = {
  id: number
  url: string
  reports: Array<{
    createdAt: string
    score: number
  }>
}

export async function getServerSideProps(context: any) {
  const session = await getServerSession(context.req, context.res, authOptions)
  if (!session || !session.user?.email) {
    return { redirect: { destination: "/", permanent: false } }
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      sites: {
        include: {
          reports: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
  })

  const sites: SiteWithLatest[] =
    user?.sites.map((site) => ({
      id: site.id,
      url: site.url,
      reports: site.reports.map((r) => ({
        createdAt: r.createdAt.toISOString(),
        score: r.score,
      })),
    })) ?? []

  return { props: { sites } }
}

export default function SitesPage({ sites }: { sites: SiteWithLatest[] }) {
  const [sitesState, setSites] = useState<SiteWithLatest[]>(sites)
  const [running, setRunning] = useState<Record<number, boolean>>({})
  const [status, setStatus] = useState<Record<number, "success" | "error" | null>>({})

  // Save latest PDF metadata for each site
  const [latestReportMeta, setLatestReportMeta] = useState<Record<number, ReportMeta | null>>({})

  useEffect(() => {
    const loadAll = async () => {
      const entries = await Promise.all(
        sites.map(async (site) => {
          try {
            const res = await fetch(`/api/reports?siteId=${site.id}`)
            const json = await res.json() as { reports?: ReportMeta[]; error?: string }
            if (json.reports && json.reports.length > 0) {
              return [site.id, json.reports[0] as ReportMeta] as const // Latest report first
            }
          } catch {
            // ignore
          }
          return [site.id, null] as const
        })
      )
      setLatestReportMeta(Object.fromEntries(entries))
    }
    loadAll()
  }, [sites])

  const runTest = async (site: SiteWithLatest) => {
    setRunning((prev) => ({ ...prev, [site.id]: true }))
    setStatus((prev) => ({ ...prev, [site.id]: null }))

    try {
      const res = await fetch(`/api/sites/${site.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: site.url }),
      })
      const json = await res.json()

      if (res.ok) {
        setStatus((prev) => ({ ...prev, [site.id]: "success" }))

        // atsvaidzinām jaunāko reportu metadatus
        const r2 = await fetch(`/api/reports?siteId=${site.id}`)
        const j2 = await r2.json() as { reports?: ReportMeta[] }
        const newest = j2.reports?.[0] ?? null
        setLatestReportMeta((prev) => ({ ...prev, [site.id]: newest }))

        // Refresh latest time
        setSites((prev) =>
          prev.map((s) =>
            s.id === site.id
              ? {
                ...s,
                reports: [
                  {
                    createdAt: new Date().toISOString(),
                    score: json?.metrics?.score ?? s.reports?.[0]?.score ?? 0,
                  },
                ],
              }
              : s
          )
        )
      } else {
        setStatus((prev) => ({ ...prev, [site.id]: "error" }))
        console.error(json?.error || "Run test failed")
      }
    } catch (err) {
      setStatus((prev) => ({ ...prev, [site.id]: "error" }))
      console.error(err)
    } finally {
      setRunning((prev) => ({ ...prev, [site.id]: false }))
    }
  }

  return (
    <>
      <h1 className="text-2xl font-bold mb-4">Your Sites</h1>

      <div className="toolbar">
        <Link href="/sites/add" className="button button--primary button--large">
          Add a new site
        </Link>
      </div>

      {sitesState.length === 0 ? (
        <p className="text-gray-500">You haven’t added any sites yet.</p>
      ) : (
        <ul className="list list--sites">
          {sitesState.map((site) => {
            const latest = site.reports?.[0] // Last tested and score
            const meta = latestReportMeta[site.id] // PDF link

            return (
              <li key={site.id} className="list--item site">
                <Link href={`/sites/${site.id}`} className="site__url">
                  {site.url}
                </Link>

                <div className="site__last-tested">
                  {latest ? (
                    <p>
                      Tested{" "}
                      {formatDistanceToNow(new Date(latest.createdAt), { addSuffix: true })}
                      {status[site.id] === "success" && (
                        <span className="text-green-600"> ✔</span>
                      )}
                      {status[site.id] === "error" && (
                        <span className="text-red-600"> ✖</span>
                      )}
                    </p>
                  ) : (
                    <p>Not tested yet</p>
                  )}
                </div>

                <div className={`site__score${!latest ? " disabled" : ""}`}>
                  {latest ? <ScoreCircle score={latest.score} /> : <ScoreCircle score="00" />}
                </div>

                <div className="site__actions">
                  {meta && (
                    <a
                      href={meta.href} // this way /api/reports/[siteId]/file/[fileName.pdf]
                      className="button button--secondary button--framed"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View Report
                    </a>
                  )}

                  <button
                    onClick={() => runTest(site)}
                    disabled={!!running[site.id]}
                    className="button button--secondary"
                  >
                    {running[site.id] ? "Running..." : "Run Test"}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
