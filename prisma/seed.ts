import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  await prisma.site.createMany({
    data: [
      { url: "https://example.com", owner: "Alice" },
      { url: "https://a11y.io", owner: "Bob" }
    ]
  })
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
//
// docker compose exec app npx tsx prisma/seed.ts
//