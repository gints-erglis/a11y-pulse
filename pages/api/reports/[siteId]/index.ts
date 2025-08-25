// pages/api/reports/[siteId]/index.ts
import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/pages/api/auth/[...nextauth]"
import { prisma } from "@/lib/prisma"
import path from "path"
import fs from "fs/promises"

type ReportMeta = {
  file: string;           // pilns faila nosaukums, piem. 2025-08-17_12-30-11.pdf
  href: string;           // drošs API ceļš uz failu
  createdAt: string;      // ISO datums klientam
  size: number;           // byte
};

type ReportsResponse = { reports: ReportMeta[] } | { error: string }

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ReportsResponse>
) {
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user?.email) {
    return res.status(401).json({ error: "Not authorized" })
  }

  const siteId = Number(req.query.siteId)
  if (!Number.isInteger(siteId) || siteId <= 0) {
    return res.status(400).json({ error: "Missing or invalid siteId" })
  }

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { owner: true },
  })

  if (!site || site.owner.email !== session.user.email) {
    return res.status(403).json({ error: "Access denied" })
  }

  const dirPath = path.join(process.cwd(), "reports", `site-${siteId}`)

  try {
    const files = await fs.readdir(dirPath)

    const pdfs = await Promise.all(
      files
        .filter((f) => f.toLowerCase().endsWith(".pdf"))
        .map(async (f) => {
          const full = path.join(dirPath, f)
          const stat = await fs.stat(full)
          return {
            file: f,
            href: `/api/reports/${siteId}/file/${encodeURIComponent(f)}`,
            createdAt: new Date(stat.mtimeMs).toISOString(),
            size: stat.size,
          } as ReportMeta
        })
    )

    // Ja gribi “jaunākos vispirms” — pēc mtime
    pdfs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return res.status(200).json({ reports: pdfs })
  } catch {
    // Nav mapes / nav failu — atgriežam tukšu sarakstu
    return res.status(200).json({ reports: [] })
  }
}
