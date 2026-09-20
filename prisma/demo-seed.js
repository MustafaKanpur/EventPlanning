/*
 * Creates a realistic event so the redesigned screens can be reviewed with data in them.
 *
 *   node prisma/demo-seed.js          seed it
 *   node prisma/demo-seed.js --clean  remove every trace of it
 *
 * Everything it writes is identifiable: the event name ends with "(demo)" and the people
 * it invents use @demo.invalid addresses, so cleanup is exact and can't catch real rows.
 * Deleting the event cascades to its blocks, tasks, budget, registrants and files.
 */
const { PrismaClient } = require("@prisma/client");
const { DEFAULT_SCREENS } = require("../lib/default-screens-data.js");
const prisma = new PrismaClient();

const EVENT_SUFFIX = "(demo)";
const DEMO_DOMAIN = "@demo.invalid";

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
  console.log("done — nothing else was touched.");
}

async function seed() {
  const owner = await prisma.teamMember.findFirst({
    where: { email: { not: { endsWith: DEMO_DOMAIN } } },
    orderBy: { createdAt: "asc" },
  });
  if (!owner) throw new Error("No real team member to own the demo event. Sign in first.");

  // Eleven days out, so the countdown sits inside the 14-day danger threshold.
  const eventDate = new Date();
  eventDate.setDate(eventDate.getDate() + 11);
  eventDate.setHours(0, 0, 0, 0);

  const at = (hour, minute) => {
    const d = new Date(eventDate);
    d.setHours(hour, minute, 0, 0);
    return d;
  };
  const dayOffset = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const people = [];
  for (const [name, role, phone] of [
    ["Priya Raman", "ORGANIZER", "+1 555 0142"],
    ["Marcus Bell", "STAFF", "+1 555 0177"],
    ["Yuki Tanaka", "STAFF", null],
  ]) {
    const email = `${name.split(" ")[0].toLowerCase()}${DEMO_DOMAIN}`;
    people.push(
      await prisma.teamMember.upsert({
        where: { email },
        update: { name, role, phone },
        create: { name, email, role, phone },
      }),
    );
  }
  const [priya, marcus, yuki] = people;

  const event = await prisma.event.create({
    data: {
      name: `Harvest Gala ${EVENT_SUFFIX}`,
      eventDate,
      status: "PLANNING",
      venue: "Riverside Hall",
      capacity: 300,
      // Set deliberately below the total allocation so the goal tick lands on the bar.
      fundraisingGoal: 18000,
      ownerId: owner.id,
      members: {
        create: people.map((p) => ({ teamMemberId: p.id, role: p.role })),
      },
    },
  });

  // The same default screens a real "Create event" produces.
  const defaultScreens = {};
  for (let i = 0; i < DEFAULT_SCREENS.length; i++) {
    const spec = DEFAULT_SCREENS[i];
    defaultScreens[spec.name] = await prisma.screenDefinition.create({
      data: {
        eventId: event.id,
        name: spec.name,
        viewType: spec.viewType,
        position: i,
        isSystem: true,
        createdById: owner.id,
        fields: {
          create: spec.fields.map((f, position) => ({
            key: f.key,
            label: f.label,
            type: f.type,
            position,
            required: f.required ?? false,
            options: f.options,
          })),
        },
      },
    });
  }

  const budget = {};
  for (const [key, category, allocated, items, vendor] of [
    ["venue", "Venue", 6000, [["Hall hire", 5500, 5500]], ["Riverside Hall", "events@demo.invalid", "+1 555 0110", "CONFIRMED", 20]],
    [
      "food",
      "Food",
      12000,
      [
        ["Catering deposit", 4000, 4000],
        ["Balance on the night", 5000, 0],
      ],
      ["Acme Catering", "hello@demo.invalid", "+1 555 0123", "AWAITING_REPLY", 9],
    ],
    // Deliberately overspent: exercises the danger variance and "Over" status.
    ["av", "AV", 2500, [["Sound & lighting", 2400, 2900]], ["Northside AV", "bookings@demo.invalid", "+1 555 0188", "CONFIRMED", 14]],
    ["decor", "Decor", 1500, [], ["Bloom & Vine", null, null, "TO_CONTACT", null]],
  ]) {
    const line = await prisma.budgetLine.create({
      data: { eventId: event.id, category, allocatedAmount: allocated },
    });
    budget[key] = line;
    for (const [name, planned, actual] of items) {
      await prisma.budgetLineItem.create({
        data: { budgetLineId: line.id, name, plannedAmount: planned, actualAmount: actual },
      });
    }
    if (vendor) {
      const [vName, vEmail, vPhone, vStatus, contactedDaysAgo] = vendor;
      await prisma.vendor.create({
        data: {
          budgetLineId: line.id,
          name: vName,
          contactEmail: vEmail,
          contactPhone: vPhone,
          status: vStatus,
          lastContactedAt: contactedDaysAgo === null ? null : dayOffset(-contactedDaysAgo),
        },
      });
    }
  }

  const blocks = [
    {
      title: "Vendor load-in",
      location: "Loading dock",
      start: at(15, 0),
      end: at(16, 0),
      tasks: [
        { title: "Confirm dock access with building", status: "DONE", assignee: marcus },
        // Overdue: drives the danger due-date and the "Blocking the schedule" rail.
        { title: "Send vendor list to venue security", due: dayOffset(-3), assignee: marcus },
      ],
    },
    {
      title: "Doors & welcome drinks",
      location: "Main foyer",
      start: at(16, 0),
      end: at(17, 0),
      tasks: [{ title: "Brief the greeters", due: dayOffset(4), assignee: priya }],
    },
    {
      // 15-minute gap before this one.
      title: "Dinner service",
      location: "Ballroom",
      start: at(17, 15),
      end: at(19, 0),
      tasks: [
        {
          title: "Final headcount to caterer",
          due: dayOffset(2),
          assignee: priya,
          budget: "food", // makes the "Draws on Food" footer appear
        },
      ],
    },
    {
      // One-hour gap before this one.
      title: "Speeches & live auction",
      location: "Ballroom stage",
      start: at(20, 0),
      end: at(21, 30),
      tasks: [
        { title: "Auction script to the MC", due: dayOffset(-1), assignee: yuki },
        { title: "Test the radio mics", due: dayOffset(6), assignee: yuki, budget: "av" },
      ],
    },
    { title: "Raffle draw", location: null, start: null, end: null, tasks: [] },
    { title: "Photo call with major donors", location: null, start: null, end: null, tasks: [] },
  ];

  let taskPosition = 0;
  for (const block of blocks) {
    const created = await prisma.scheduleItem.create({
      data: {
        eventId: event.id,
        title: block.title,
        location: block.location,
        startTime: block.start,
        endTime: block.end,
      },
    });
    for (const task of block.tasks) {
      // Tasks are checklist records now — identical to rows a user would add by hand.
      const budgetId = task.budget ? budget[task.budget].id : null;
      const record = await prisma.screenRecord.create({
        data: {
          screenId: defaultScreens.Tasks.id,
          position: taskPosition++,
          values: {
            title: task.title,
            done: task.status === "DONE",
            due: task.due ? task.due.toISOString().slice(0, 10) : null,
            owner: task.assignee?.id ?? null,
            block: created.id,
            budget: budgetId,
          },
        },
      });
      const links = [{ fieldKey: "block", targetType: "SCHEDULE_ITEM", targetId: created.id }];
      if (task.assignee) {
        links.push({ fieldKey: "owner", targetType: "TEAM_MEMBER", targetId: task.assignee.id });
      }
      if (budgetId) {
        links.push({ fieldKey: "budget", targetType: "BUDGET_LINE", targetId: budgetId });
      }
      await prisma.recordLink.createMany({
        data: links.map((l) => ({ recordId: record.id, ...l })),
      });
    }
  }

  const guests = [
    ["Alina Whitfield", "PAID", 150],
    ["Tom Oyelaran", "PAID", 150],
    ["Fen Zhao", "PAID", 300],
    ["Rosa Iglesias", "PAID", 150],
    ["Dev Sharma", "PAID", 150],
    ["Claire Beaumont", "PAID", 300],
    ["Idris Kane", "PENDING", 150],
    ["Marta Nowak", "PENDING", 150],
    ["Sam Okafor", "UNPAID", 150],
    ["Hannah Reid", "UNPAID", 150],
  ];
  for (const [name, paymentStatus, amount] of guests) {
    await prisma.registrant.create({
      data: {
        eventId: event.id,
        name,
        email: `${name.split(" ")[0].toLowerCase()}${DEMO_DOMAIN}`,
        amount,
        paymentStatus,
        // Paid registrations post against Food, so the ledger shows the linkage.
        budgetLineId: paymentStatus === "PAID" ? budget.food.id : null,
      },
    });
  }

  const firstBlock = await prisma.scheduleItem.findFirst({
    where: { eventId: event.id, startTime: { not: null } },
    orderBy: { startTime: "asc" },
  });

  const files = [
    ["Signed venue contract", "Shared drive / Contracts", "https://example.org/contract", priya, { budget: budget.venue.id }],
    ["Run sheet template", "Shared drive / Templates", "https://example.org/runsheet", null, {}],
    ["Centrepieces & linens", "Storage room B", null, marcus, { block: firstBlock ? firstBlock.id : null }],
  ];
  for (let i = 0; i < files.length; i++) {
    const [name, location, url, assignee, attach] = files[i];
    const record = await prisma.screenRecord.create({
      data: {
        screenId: defaultScreens.Files.id,
        position: i,
        values: {
          name,
          location,
          link: url,
          notes: null,
          owner: assignee ? assignee.id : null,
          block: attach.block || null,
          budget: attach.budget || null,
        },
      },
    });
    const links = [];
    if (assignee) links.push({ fieldKey: "owner", targetType: "TEAM_MEMBER", targetId: assignee.id });
    if (attach.block) links.push({ fieldKey: "block", targetType: "SCHEDULE_ITEM", targetId: attach.block });
    if (attach.budget) links.push({ fieldKey: "budget", targetType: "BUDGET_LINE", targetId: attach.budget });
    if (links.length) {
      await prisma.recordLink.createMany({ data: links.map((l) => ({ recordId: record.id, ...l })) });
    }
  }

  // ── the composed-tier test case ────────────────────────────────────────────
  // One user-built screen that makes the vendor page, the run of show and the budget
  // all richer, without any of them knowing "Vendor Stalls" exists.
  const stalls = await prisma.screenDefinition.create({
    data: {
      eventId: event.id,
      name: "Vendor Stalls",
      viewType: "TABLE",
      position: DEFAULT_SCREENS.length,
      createdById: owner.id,
      fields: {
        create: [
          { key: "stall", label: "Stall name", type: "TEXT", position: 0, required: true },
          { key: "vendor", label: "Vendor", type: "LINK", position: 1, options: { targetType: "VENDOR", allowMultiple: false } },
          { key: "slot", label: "Setup slot", type: "LINK", position: 2, options: { targetType: "SCHEDULE_ITEM", allowMultiple: false } },
          // Rollup: this column's sum posts to the Food budget line as committed spend.
          { key: "fee", label: "Fee", type: "CURRENCY", position: 3, rollupTarget: budget.food.id },
          // Rollup: these records project onto the run-of-show timeline.
          { key: "setup_at", label: "Setup at", type: "DATETIME", position: 4, rollupTarget: "RUN_OF_SHOW" },
          { key: "permit", label: "Permit received", type: "CHECKBOX", position: 5 },
        ],
      },
    },
  });

  const loadIn = await prisma.scheduleItem.findFirst({
    where: { eventId: event.id, title: { contains: "load-in" } },
  });
  const vendorRows = await prisma.vendor.findMany({ where: { budgetLine: { eventId: event.id } } });
  const vendorIdByName = new Map(vendorRows.map((v) => [v.name, v.id]));

  const stallRows = [
    ["Hot food — north aisle", "Acme Catering", 450, true, at(15, 30)],
    // Deliberately inside the 19:00-20:00 gap, to show a projection does not make an
    // unscheduled hour look accounted for.
    ["Sound & staging", "Northside AV", 900, false, at(19, 30)],
    ["Flowers & greenery", "Bloom & Vine", 300, false, null],
  ];
  for (let i = 0; i < stallRows.length; i++) {
    const [stall, vendorName, fee, permit, setupAt] = stallRows[i];
    const vendorId = vendorIdByName.get(vendorName) || null;
    const record = await prisma.screenRecord.create({
      data: {
        screenId: stalls.id,
        position: i,
        values: {
          stall,
          vendor: vendorId,
          slot: loadIn ? loadIn.id : null,
          fee,
          permit,
          setup_at: setupAt ? setupAt.toISOString() : null,
        },
      },
    });
    const links = [];
    if (vendorId) links.push({ fieldKey: "vendor", targetType: "VENDOR", targetId: vendorId });
    if (loadIn) links.push({ fieldKey: "slot", targetType: "SCHEDULE_ITEM", targetId: loadIn.id });
    if (links.length) {
      await prisma.recordLink.createMany({ data: links.map((l) => ({ recordId: record.id, ...l })) });
    }
  }

  console.log(`seeded: ${event.name}`);
  console.log(`  /events/${event.id}/schedule`);
  console.log(`  ${blocks.length} blocks (2 unplaced, 15m + 1h gaps), 6 tasks (2 overdue)`);
  console.log(`  4 budget categories (AV deliberately overspent), 4 vendors`);
  console.log(`  ${guests.length} registrants (6 paid), 3 files`);
  console.log(`  Vendor Stalls screen: ${stallRows.length} rows linked to vendors + the load-in block`);
  console.log(`  rollups: fees post to the Food budget line, setup times project onto the run of show`);
  console.log(`\nremove it all with: node prisma/demo-seed.js --clean`);
}

const main = process.argv.includes("--clean") ? clean : seed;
main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
