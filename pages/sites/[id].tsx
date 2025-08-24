// pages/sites/[id].tsx
import { useEffect, useState } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import ScoreCircle from "@/components/ScoreCircle";
import { formatDistanceToNow } from "date-fns";

type ReportMeta = {
  id: number
  file: string
  href: string
  createdAt: string
  size?: number
  score: number
};

export async function getServerSideProps(context: any) {
  const session = await getServerSession(context.req, context.res, authOptions);
  const siteId = parseInt(context.params.id, 10);

  if (!session?.user?.email) {
    return { redirect: { destination: "/", permanent: false } };
  }

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { owner: true },
  });

  if (!site || site.owner.email !== session.user.email) {
    return { notFound: true };
  }

  return {
    props: { site: { id: site.id, url: site.url } },
  };
}

export default function SitePage({ site }: { site: { id: number; url: string } }) {
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<"success" | "error" | null>(null);
  const [latestHref, setLatestHref] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Record<string, boolean>>({})

  async function loadReports() {
    try {
      const res = await fetch(`/api/reports?siteId=${site.id}`);
      const data = (await res.json()) as { reports: ReportMeta[] };
      setReports(Array.isArray(data.reports) ? data.reports : []);
    } catch (e) {
      console.error("Failed to load reports:", e);
      setReports([]);
    }
  }

  async function handleDelete(file: string) {
    if (!confirm(`Delete report "${file}"?`)) return
    setDeleting(d => ({ ...d, [file]: true }))
    try {
      const res = await fetch(
        `/api/reports/${site.id}/file/${encodeURIComponent(file)}`,
        { method: 'DELETE' }
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)

      setReports(prev => {
        const next = prev.filter(r => r.file !== file)
        setLatestHref(next[0]?.href ?? null)
        return next
      })
    } catch (e: any) {
      alert(`Failed to delete: ${e?.message || e}`)
    } finally {
      setDeleting(({ [file]: _, ...rest }) => rest)
    }
  }

  function LineChart({ data }: { data: { x: Date; y: number }[] }) {
    if (!data.length) return <p className="text-gray-500">No data yet.</p>
    const w = 640, h = 200, pad = 30
    const xs = data.map(d => d.x.getTime())
    const ys = data.map(d => d.y)
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = 0, maxY = Math.max(100, Math.max(...ys, 0))
    const xScale = (t: number) =>
      pad + ((t - minX) / Math.max(1, (maxX - minX))) * (w - pad * 2)
    const yScale = (v: number) =>
      h - pad - ((v - minY) / Math.max(1, (maxY - minY))) * (h - pad * 2)

    const pathD = data
      .map((d, i) => `${i ? 'L' : 'M'} ${xScale(d.x.getTime())} ${yScale(d.y)}`)
      .join(' ')

    const xTicks = 4
    const tickTs = Array.from({ length: xTicks + 1 }, (_, i) =>
      minX + (i * (maxX - minX)) / xTicks
    )

    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="card">
        {/* axes */}
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="currentColor" strokeOpacity="0.2"/>
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="currentColor" strokeOpacity="0.2"/>

        {/* x ticks */}
        {tickTs.map((t, i) => (
          <g key={i} transform={`translate(${xScale(t)},0)`}>
            <line y1={h - pad} y2={h - pad + 4} stroke="currentColor"/>
            <text y={h - pad + 16} textAnchor="middle" fontSize="10">
              {new Date(t).toLocaleDateString()}
            </text>
          </g>
        ))}

        {/* y ticks (0, 50, 100) */}
        {[0, 50, 100].map(y => (
          <g key={y} transform={`translate(0,${yScale(y)})`}>
            <line x1={pad - 4} x2={pad} stroke="currentColor"/>
            <text x={pad - 8} textAnchor="end" dy="0.32em" fontSize="10">{y}</text>
            <line x1={pad} x2={w - pad} stroke="currentColor" strokeOpacity="0.07"/>
          </g>
        ))}

        {/* line */}
        <path d={pathD} fill="none" stroke="currentColor" strokeWidth="2" />
        {/* points */}
        {data.map((d, i) => (
          <circle key={i} cx={xScale(d.x.getTime())} cy={yScale(d.y)} r="3" fill="currentColor" />
        ))}
      </svg>
    )
  }

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site.id]);

  const handleRunTest = async () => {
    setRunning(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/sites/${site.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: site.url }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);

      setStatus("success");
      await loadReports(); // refresh list
    } catch (err) {
      console.error(err);
      setStatus("error");
    } finally {
      setRunning(false);
    }
  };

  const latest = reports[0];
  const series = reports
    .map(r => ({ x: new Date(r.createdAt), y: Number(r.score ?? 0) }))
    .sort((a, b) => a.x.getTime() - b.x.getTime())

  return (
    <div className="site__full max-w-3xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">{site.url}</h1>

      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={handleRunTest}
          className="button button--primary"
          disabled={running}
        >
          {running ? "Running Test..." : "Run A11Y Test"}
        </button>

        {status === "success" && <span className="text-green-600">✔ Test completed</span>}
        {status === "error" && <span className="text-red-600">✖ Test failed</span>}
      </div>

      <h2 className="text-xl font-semibold mb-2">Latest</h2>
      <div className="card report__latest">
        <div className={`site__score${!latest ? " disabled" : ""}`}>
          <ScoreCircle score={latest ? latest.score : 0} />
        </div>
        <div>
          {latest ? (
            <p>
              Generated {formatDistanceToNow(new Date(latest.createdAt), { addSuffix: true })}
            </p>
          ) : (
            <p className="text-gray-500">No reports yet.</p>
          )}
        </div>
        {latest?.href && (
          <Link
            href={latest.href}
            className="button button--secondary button--framed"
            target="_blank"
          >
            View Report
          </Link>
        )}
      </div>

      <h2 className="text-xl font-semibold mt-6 mb-2">Score over time</h2>
      <LineChart data={series} />

      <h2 className="text-xl font-semibold mb-2">All Reports</h2>
      {reports.length === 0 ? (
        <p className="text-gray-500">No reports yet.</p>
      ) : (
        <ul className="report-list card">
          {reports.map((r) => (
            <li key={r.file} className="flex items-center justify-between gap-3">
              <span className="report-col date">
                {new Date(r.createdAt).toLocaleString()}
              </span>
              <span className="report-col score">
                {typeof r.score === 'number' ? ` (score ${r.score})` : ''}
              </span>
              <Link href={r.href} className="text-blue-600 underline" target="_blank">
                PDF Report
              </Link>

              <button
                onClick={() => handleDelete(r.file)}
                disabled={!!deleting[r.file]}
                className="button button--danger"
                aria-label={`Delete report ${r.file}`}
                title="Delete report file"
              >
                {deleting[r.file] ? 'Deleting…' : 'Delete'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
