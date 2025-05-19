import { getServerSession } from "next-auth"
import { authOptions } from "../auth/[...nextauth]"
import { prisma } from "@/lib/prisma"

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions)
  const id = Number(req.query.id)

  if (!session?.user?.email) {
    return res.status(401).json({ message: "Unauthorized" })
  }

  const site = await prisma.site.findUnique({
    where: { id },
    include: { owner: true },
  })

  if (!site || site.owner?.email !== session.user.email) {
    return res.status(403).json({ message: "Forbidden" })
  }

  if (req.method === "PUT") {
    const { url } = req.body
    if (!url.startsWith("http")) {
      return res.status(400).json({ message: "Invalid URL" })
    }
    const updated = await prisma.site.update({
      where: { id },
      data: { url },
    })
    return res.status(200).json(updated)
  }

  if (req.method === "DELETE") {
    await prisma.site.delete({
      where: { id },
    })
    return res.status(200).json({ message: "Deleted successfully" })
  }

  return res.setHeader("Allow", ["PUT", "DELETE"]).status(405).end()
}
