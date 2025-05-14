import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/pages/api/auth/[...nextauth]"
import type { NextApiRequest, NextApiResponse } from "next"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session || !session.user?.email) {
    return res.status(401).json({ message: "Unauthorized" })
  }

  if (req.method === "POST") {
    const { url } = req.body
    if (!url) return res.status(400).json({ message: "Missing URL" })

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) return res.status(404).json({ message: "User not found" })

    const site = await prisma.site.create({
      data: {
        url,
        ownerId: user.id,
      },
    })

    return res.status(201).json(site)
  }

  // Optional: support GET /api/sites for current user
  if (req.method === "GET") {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { sites: true },
    })

    return res.status(200).json(user?.sites ?? [])
  }

  res.setHeader("Allow", ["POST", "GET"])
  res.status(405).end(`Method ${req.method} Not Allowed`)
}
