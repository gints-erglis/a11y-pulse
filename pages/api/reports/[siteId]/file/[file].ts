import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import { existsSync } from "fs"

type Data =
  | { ok: true }
  | { error: string }

function isSafePdfName(name: string): boolean {
  return /^[A-Za-z0-9._-]+\.pdf$/.test(name)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data | void>) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.email) {
    return res.status(401).json({ error: 'Not authorized' })
  }

  const siteId = Number(req.query.siteId)
  const file = String(req.query.file || "")
  const rawFileParam = Array.isArray(req.query.file) ? req.query.file[0] : req.query.file
  const fileParam = rawFileParam ? decodeURIComponent(rawFileParam) : ''

  if (!Number.isInteger(siteId) || siteId <= 0) {
    return res.status(400).json({ error: 'Invalid siteId' })
  }
  if (!fileParam || !isSafePdfBasename(fileParam)) {
    return res.status(400).json({ error: 'Invalid file name' })
  }

  // Pārbaude – vai lietotājam pieder šis site
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { owner: { select: { email: true } } },
  })
  if (!site || site.owner?.email !== session.user.email) {
    return res.status(403).json({ error: 'Access denied' })
  }

  const { absPath, relPath } = resolveReportPath(siteId, fileParam) // check
  const reportsRoot = path.join(process.cwd(), "reports")
  const siteDir = path.join(reportsRoot, `site-${siteId}`)
  const diskPath = path.join(siteDir, file)

  try {
    if (req.method === 'GET') {
      // Straumē PDF
      const stat = await fsp.stat(absPath).catch(() => null)
      if (!stat || !stat.isFile()) return res.status(404).json({ error: 'File not found' })

      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Length', String(stat.size))
      res.setHeader('Content-Disposition', `inline; filename="${encodeHeaderFilename(fileParam)}"`)
      const stream = fs.createReadStream(absPath)
      stream.on('error', () => {
        if (!res.headersSent) res.status(500).end()
        else res.end()
      })
      stream.pipe(res)
      return
    }

    if (req.method === "DELETE") {
      if (existsSync(diskPath)) {
        try {
          await fs.unlink(diskPath)
        } catch (e) {
          // ignore if deleted already
        }
      }

      const relPosix = path.posix.join(`site-${siteId}`, file)
      const del = await prisma.report.deleteMany({
        where: {
          siteId,
          OR: [
            { pdfPath: relPosix },
            { pdfPath: { endsWith: `/${file}` } },
          ],
        },
      })

      return res.status(200).json({ ok: true, deleted: del.count })
    }

    if (req.method === 'HEAD' || req.method === 'OPTIONS') {
      res.setHeader('Allow', 'GET,DELETE,HEAD,OPTIONS')
      return res.status(204).end()
    }

    res.setHeader('Allow', 'GET,DELETE,HEAD,OPTIONS')
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` })
  } catch (e: any) {
    console.error('File API error:', e)
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Internal Server Error' })
    }
  }
}

function isSafePdfBasename(name: string) {
  // Tikai faila nosaukums (bez slīpsvītrām), jābeidzas ar .pdf
  if (name.includes('/') || name.includes('\\')) return false
  return /\.pdf$/i.test(name)
}

function resolveReportPath(siteId: number, file: string) {
  const base = path.resolve(process.cwd(), 'reports', `site-${siteId}`)
  const absPath = path.resolve(base, file)

  // Drošības pārbaude — nedrīkst “izlēkt” ārā no mapes
  if (!absPath.startsWith(base + path.sep)) {
    throw new Error('Path traversal detected')
  }

  // Relatīvais ceļš DB laukam (POSIX, lai konsekventi)
  const relPath = path.posix.join(`site-${siteId}`, file)
  return { absPath, relPath }
}

function encodeHeaderFilename(name: string) {
  // RFC savietīgs Content-Disposition filename
  // (vienkāršota versija)
  return name.replace(/"/g, '%22')
}
