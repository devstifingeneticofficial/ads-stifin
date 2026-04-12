import { PrismaClient } from "@prisma/client"
const db = new PrismaClient()

async function main() {
  const templates = await db.briefTemplate.findMany()
  console.log("Total Templates Found:", templates.length)
  console.log(JSON.stringify(templates, null, 2))
}

main().finally(() => db.$disconnect())
