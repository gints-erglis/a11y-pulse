import { useEffect, useState } from "react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/pages/api/auth/[...nextauth]"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import ScoreCircle from "@/components/ScoreCircle";
import { formatDistanceToNow } from 'date-fns';

export async function getServerSideProps(context) {
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
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  })

  const sites = user?.sites.map(site => ({
    ...site,
    reports: site.reports.map(report => ({
      ...report,
      createdAt: report.createdAt.toISOString(),
    })),
  })) || []

  return {
    props: {
      sites,
    },
  }
}

export default function SitesPage({ sites }) {
  const [sitesState, setSites] = useState(sites)
  const [running, setRunning] = useState<Record<number, boolean>>({})
  const [status, setStatus] = useState<Record<number, 'success' | 'error' | null>>({})
  const [latestReports, setLatestReports] = useState({})

  useEffect(() => {
    sites.forEach(async (site) => {
      const res = await fetch(`/api/reports/${site.id}`)
      const json = await res.json()
      if (json.reports?.length > 0) {
        setLatestReports(prev => ({
          ...prev,
          [site.id]: json.reports[0], // latest
        }))
      }
    })
  }, [sites])

  const runTest = async (site) => {
    setRunning(prev => ({ ...prev, [site.id]: true }))
    setStatus(prev => ({ ...prev, [site.id]: null }))

    try {
      const res = await fetch(`/api/sites/${site.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: site.url }),
      })
      const json = await res.json()

      if (res.ok) {
        setStatus(prev => ({ ...prev, [site.id]: 'success' }))

        // Fetch latest report filename
        const reportsRes = await fetch(`/api/reports/${site.id}`)
        const reportsJson = await reportsRes.json()
        const latestFilename = reportsJson.reports?.[0]

        setLatestReports(prev => ({
          ...prev,
          [site.id]: latestFilename,
        }))

        setSites(prev =>
          prev.map(s =>
            s.id === site.id
              ? {
                ...s,
                reports: [{
                  createdAt: new Date().toISOString(),
                  score: json.metrics?.score ?? 0,
                }],
              }
              : s
          )
        )
      } else {
        setStatus(prev => ({ ...prev, [site.id]: 'error' }))
        console.error(json.error)
      }
    } catch (err) {
      setStatus(prev => ({ ...prev, [site.id]: 'error' }))
      console.error(err)
    } finally {
      setRunning(prev => ({ ...prev, [site.id]: false }))
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
      {sites.length === 0 ? (
        <p className="text-gray-500">You haven’t added any sites yet.</p>
      ) : (
        <ul className="list list--sites">
          {sitesState.map((site) => {
            const latest = site.reports?.[0];
            return (
              <li key={site.id} className="list--item site">
                  <Link href={`/sites/${site.id}`} className="site__url">
                    {site.url}
                  </Link>
                  <div className="site__last-tested">
                    {latest ? (
                      <p>
                        Tested {formatDistanceToNow(new Date(latest.createdAt), {addSuffix: true})}
                        {status[site.id] === 'success' && (
                          <span className="text-green-600">✔</span>
                        )}
                        {status[site.id] === 'error' && (
                          <span className="text-red-600">✖</span>
                        )}
                      </p>
                    ) : (
                      <p>Not tested yet</p>
                    )}
                  </div>
                  <div className={`site__score${!latest ? ' disabled' : ''}`}>
                    {latest ? (
                      <ScoreCircle score={latest.score}/>
                    ) : (
                      <ScoreCircle score="00"/>
                    )}
                  </div>
                  <div className="site__actions">
                    {latestReports[site.id] && (
                      <Link
                        href={`/api/reports/${site.id}/${encodeURIComponent(latestReports[site.id])}.pdf`}
                        className="button button--secondary button--framed"
                        target="_blank"
                      >
                        View Report
                      </Link>
                    )}
                    <button
                      onClick={() => runTest(site)}
                      disabled={running[site.id]}
                      className="button button--secondary"
                    >
                      {running[site.id] ? 'Running...' : 'Run Test'}
                    </button>
                  </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  )
}