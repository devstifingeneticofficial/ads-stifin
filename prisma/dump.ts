import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const notifTemplates = await prisma.notificationTemplate.findMany()
  const briefTemplates = await prisma.briefTemplate.findMany()

  console.log("--- NOTIF TEMPLATES ---")
  console.log(JSON.stringify(notifTemplates, null, 2))
  console.log("--- BRIEF TEMPLATES ---")
  console.log(JSON.stringify(briefTemplates, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
