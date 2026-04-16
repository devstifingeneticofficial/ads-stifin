const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const ts = process.env.SMOKE_TS;
  const users = [
    { role: "ADVERTISER", email: `smoke.adv.${ts}@test.local`, name: "Smoke Advertiser", phone: "081111111111", city: "Bandung", password: "Pass123!" },
    { role: "STIFIN", email: `smoke.stifin.${ts}@test.local`, name: "Smoke Stifin", phone: "082222222222", city: "Jakarta", password: "Pass123!" },
    { role: "KONTEN_KREATOR", email: `smoke.creator.${ts}@test.local`, name: "Smoke Creator", phone: "083333333333", city: "Yogya", password: "Pass123!" }
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { ...u },
      create: { ...u }
    });
  }

  const creator = await prisma.user.findUnique({ where: { email: `smoke.creator.${ts}@test.local` } });
  const allCreators = await prisma.user.findMany({ where: { role: "KONTEN_KREATOR" }, select: { id: true } });
  const enabledMap = {};
  for (const c of allCreators) enabledMap[c.id] = false;
  if (creator) enabledMap[creator.id] = true;

  await prisma.systemSetting.upsert({
    where: { key: "managed_user_enabled_map" },
    update: { value: JSON.stringify(enabledMap) },
    create: { key: "managed_user_enabled_map", value: JSON.stringify(enabledMap) }
  });

  await prisma.systemSetting.upsert({
    where: { key: "content_creator_rotation_index" },
    update: { value: "-1" },
    create: { key: "content_creator_rotation_index", value: "-1" }
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
