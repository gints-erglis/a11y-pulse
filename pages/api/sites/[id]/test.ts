import type { NextApiRequest, NextApiResponse } from 'next'
import path from 'path'
import runA11yTest from '@/scripts/a11y-core' // use ts-ignore if .js
import fs from 'fs'
import {prisma} from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { id } = req.query
  const { url } = req.body
  if (!url || !id) return res.status(400).json({ error: 'Missing URL or ID' })

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outputDir = path.join(process.cwd(), 'reports', `site-${id}`)
  const filename = `${timestamp}.pdf`
  const outputPath = path.join(outputDir, filename)

  try {
    const metrics = await runA11yTest(url, outputPath);
    console.log(`Prisma-report: ${prisma.report}`);
    await prisma.report.create({
      data: {
        siteId: parseInt(id as string, 10),
        pdfPath: outputPath.replace(process.cwd(), ""),
        ...metrics
      }
    });

    return res.status(200).json({
      message: 'Report created successfully!',
      report: `/api/reports/site-${id}/${filename}`,
      metrics
    })
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Unknown error',
    })
  }
}
