import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import type { Site } from '@prisma/client'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ sites: Site[] } | { error: string }>
) {
  const session = await getServerSession(req, res, authOptions)

  if (!session || !session.user?.email) {
    return res.status(401).json({ message: "Unauthorized" })
  }

  if (req.method === "POST") {
    const { url } = req.body
    if (!url || !url.startsWith("http")) {
      return res.status(400).json({ message: "Invalid URL" })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    const newSite = await prisma.site.create({
      data: {
        url,
        ownerId: user.id,
      },
    })

    return res.status(200).json(newSite)
  }

  if (req.method === "GET") {
    const sites = await prisma.site.findMany({
      where: {
        owner: { email: session.user.email },
      },
    })

    return res.status(200).json(sites)
  }

  res.setHeader("Allow", ["GET", "POST"])
  res.status(405).end(`Method ${req.method} Not Allowed`)
}