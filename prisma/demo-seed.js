/*
 * Creates a realistic event so the redesigned screens can be reviewed with data in them.
 *
 *   node prisma/demo-seed.js          seed it
 *   node prisma/demo-seed.js --clean  remove every trace of it
 *
 * Everything it writes is identifiable: the event name ends with "(demo)" and the people
 * it invents use @demo.invalid addresses, so cleanup is exact and can't catch real rows.
 * Deleting the event cascades to its blocks, tasks, budget, registrants and files.
 * The event itself is built by lib/demo-event.js, shared with the recruiter demo button.
 */
const { PrismaClient } = require("@prisma/client");
const { seedDemoEvent, EVENT_SUFFIX, DEMO_DOMAIN } = require("../lib/demo-event.js");
const prisma = new PrismaClient();

async function clean() {
  const events = await prisma.event.findMany({
    where: { name: { endsWith: EVENT_SUFFIX } },
    select: { id: true, name: true },
  });
  for (const event of events) {
    await prisma.event.delete({ where: { id: event.id } });
    console.log(`removed event: ${event.name}`);
  }
  const people = await prisma.teamMember.deleteMany({
    where: { email: { endsWith: DEMO_DOMAIN } },
  });
  console.log(`removed ${people.count} demo team members`);
  const volunteers = await prisma.volunteer.deleteMany({
    where: { email: { endsWith: DEMO_DOMAIN } },
  });
  console.log(`removed ${volunteers.count} demo volunteers`);
  console.log("done — nothing else was touched.");
}

async function seed() {
  const owner = await prisma.teamMember.findFirst({
    where: { email: { not: { endsWith: DEMO_DOMAIN } } },
    orderBy: { createdAt: "asc" },
  });
  if (!owner) throw new Error("No real team member to own the demo event. Sign in first.");

  const event = await seedDemoEvent(prisma, { ownerId: owner.id });

  console.log(`seeded: ${event.name}`);
  console.log(`  /events/${event.id}/schedule`);
  console.log(`  6 blocks (2 unplaced, 15m + 1h gaps), 6 tasks (2 overdue)`);
  console.log(`  4 budget categories (AV deliberately overspent), 4 vendors`);
  console.log(`  10 registrants (6 paid), 3 files, 4 volunteers on 2 shifts`);
  console.log(`  Vendor Stalls screen linked to vendors + the load-in block`);
  console.log(`  rollups: fees post to the Food budget line, setup times project onto the run of show`);
  console.log(`
remove it all with: node prisma/demo-seed.js --clean`);
}

const main = process.argv.includes("--clean") ? clean : seed;
main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
