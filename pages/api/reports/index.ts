import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import path from "path";
import fs from "fs/promises";

type ReportMeta = {
  file: string;      // faila nosaukums (piem., 2025-08-17_12-30-11.pdf)
  href: string;      // API ceļš uz failu
  createdAt: string; // ISO
  size?: number;     // bytes (ja gribi)
  score: number;     // no DB
};

type Resp = { reports: ReportMeta[] } | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Resp>
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: "Not authorized" });
  }

  const siteId = Number(req.query.siteId);
  if (!Number.isInteger(siteId) || siteId <= 0) {
    return res.status(400).json({ error: "Missing or invalid siteId" });
  }

  // Pārbaudi īpašumtiesības
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { owner: true },
  });
  if (!site || site.owner.email !== session.user.email) {
    return res.status(403).json({ error: "Access denied" });
  }

  const reports = await prisma.report.findMany({
    where: { siteId },
    orderBy: { createdAt: "desc" },
  });

  // Uztaisi atbildi ar failu metadatiem
  const out: ReportMeta[] = await Promise.all(
    reports.map(async (r) => {
      // DB glabā relatīvu ceļu, piem. "site-1/2025-08-17_12-30-11.pdf"
      const file = path.basename(r.pdfPath);
      const abs = path.join(process.cwd(), "reports", r.pdfPath);
      const stat = await fs.stat(abs).catch(() => null);

      return {
        file,
        href: `/api/reports/${siteId}/file/${encodeURIComponent(file)}`,
        createdAt: r.createdAt.toISOString(),
        size: stat?.size,
        score: r.score ?? 0,
      };
    })
  );

  return res.status(200).json({ reports: out });
}
