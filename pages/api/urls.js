import { getSession } from "next-auth/react";
import { runA11YTest } from "@/lib/a11yTester";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export default async function handler(req, res) {
  const session = await getSession({ req });
  if (!session) return res.status(401).json({ error: "Not authenticated" });

  if (req.method === "POST") {
    const { url } = req.body;
    const result = await runA11YTest(url);

    const saved = await prisma.url.create({
      data: {
        address: url,
        score: result.score,
        lastTest: new Date(),
        user: { connect: { email: session.user.email } },
      },
    });

    res.json(saved);
  }
}