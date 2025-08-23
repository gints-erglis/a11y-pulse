// pages/api/sites/[id]/test.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import path from "path";
import fs from "fs/promises";
import { prisma } from "@/lib/prisma";
import runA11yTest from "@/lib/a11y/runA11yTest";

type OkResponse = {
  message: string;
  report: string;  // API URL uz PDF
  metrics: {
    score: number;
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
};
type ErrResponse = { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<OkResponse | ErrResponse>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: "Not authorized" });
  }

  const siteId = Number(req.query.id);
  const { url } = req.body as { url?: string };

  if (!Number.isInteger(siteId) || siteId <= 0) {
    return res.status(400).json({ error: "Missing or invalid site id" });
  }
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing URL" });
  }

  // Check access rights
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { owner: true },
  });
  if (!site || site.owner.email !== session.user.email) {
    return res.status(403).json({ error: "Access denied" });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(process.cwd(), "reports", `site-${siteId}`);
  const fileName = `${timestamp}.pdf`;
  const absPdfPath = path.join(dir, fileName);

  try {
    await fs.mkdir(dir, { recursive: true });

    // Run test (axe + PDF)
    const metrics = await runA11yTest(url, absPdfPath);

    const relPdfPath = path.posix.join(`site-${siteId}`, fileName);
    await prisma.report.create({
      data: {
        siteId,
        pdfPath: relPdfPath,
        ...metrics,
      },
    });

    const reportUrl = `/api/reports/${siteId}/file/${encodeURIComponent(fileName)}`;

    return res.status(200).json({
      message: "Report created successfully!",
      report: reportUrl,
      metrics,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err?.message ?? "Unknown error",
    });
  }
}
