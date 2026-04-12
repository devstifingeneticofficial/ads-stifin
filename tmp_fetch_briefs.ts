import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const templates = await prisma.briefTemplate.findMany()
  console.log(JSON.stringify(templates, null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
