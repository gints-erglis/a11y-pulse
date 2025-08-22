import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import type { Site } from '@prisma/client'

type SitesResponse = { sites: Site[] }
type SiteResponse = { site: Site }
type ApiError = { error: string }

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SitesResponse | SiteResponse | ApiError>
) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.email) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method === 'GET') {
    const sites = await prisma.site.findMany({
      where: { owner: { email: session.user.email } },
      orderBy: { id: 'asc' },
    })
    return res.status(200).json({ sites })
  }

  if (req.method === 'POST') {
    const { url } = (req.body || {}) as { url?: string }
    if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: 'Invalid URL' })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })
    if (!user) return res.status(404).json({ error: 'User not found' })

    const site = await prisma.site.create({
      data: { url: url.trim(), ownerId: user.id },
    })
    return res.status(201).json({ site })
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` })
}
