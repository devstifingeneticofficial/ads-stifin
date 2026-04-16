const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
(async () => {
  try {
    const count = await db.user.count();
    console.log('USER_COUNT', count);
  } catch (e) {
    console.error('DB_ERR', e?.message || e);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
})();
