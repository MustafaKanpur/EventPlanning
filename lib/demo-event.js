/*
 * The sample event behind the recruiter demo button (lib/demo.ts) and the review script
 * (prisma/demo-seed.js). Plain JS so the Node script can require it, like
 * default-screens-data.js.
 *
 * Fake people use @demo.invalid addresses. `tag` keeps their emails unique per demo visit,
 * since emails are unique columns. `isDemo` marks the roots (event, people, volunteers);
 * everything else hangs off the event and goes with it.
 */
// CommonJS on purpose: prisma/demo-seed.js loads this file with plain Node.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DEFAULT_SCREENS } = require("./default-screens-data.js");

const EVENT_SUFFIX = "(demo)";
const DEMO_DOMAIN = "@demo.invalid";

async function seedDemoEvent(prisma, { ownerId, tag = "", isDemo = false }) {
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

  // Rows go in one batch per table, and tables that don't depend on each other go in
  // parallel: about six waits on the database instead of ninety. A batch gives every row
  // the same now(), so createdAt is set 1ms apart to keep the order pages sort by. And
  // createManyAndReturn doesn't promise rows back in the order sent, so they're matched
  // by name, never by index.
  const base = Date.now();
  let tick = 0;
  const stamp = () => new Date(base + tick++);
  const byKey = (rows, key) => Object.fromEntries(rows.map((r) => [r[key], r]));
  const demoEmail = (name) => `${name.split(" ")[0].toLowerCase()}${tag}${DEMO_DOMAIN}`;

  // People stay upserts so prisma/demo-seed.js (no tag, same emails every run) can be
  // re-run. Upserts can't be batched, so they go in parallel instead.
  const [people, volunteers] = await Promise.all([
    Promise.all(
      [
        ["Priya Raman", "ORGANIZER", "+1 555 0142"],
        ["Marcus Bell", "STAFF", "+1 555 0177"],
        ["Yuki Tanaka", "STAFF", null],
      ].map(([name, role, phone]) =>
        prisma.teamMember.upsert({
          where: { email: demoEmail(name) },
          update: { name, role, phone },
          create: { name, email: demoEmail(name), role, phone, isDemo },
        }),
      ),
    ),
    Promise.all(
      [
        ["Amara Osei", "APPROVED"],
        ["Liam Novak", "APPROVED"],
        ["Sofia Russo", "APPROVED"],
        ["Ben Carter", "PENDING"],
      ].map(([name, status]) =>
        prisma.volunteer.upsert({
          where: { email: demoEmail(name) },
          update: {},
          create: { name, email: demoEmail(name), status, isDemo },
        }),
      ),
    ),
  ]);
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
      ownerId,
      isDemo,
      members: {
        create: people.map((p) => ({ teamMemberId: p.id, role: p.role })),
      },
    },
  });

  const budgetSpec = [
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
  ];

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

  const shiftSpec = [
    ["Registration desk", at(15, 30), at(18, 0), 3, [0, 1]],
    ["Auction runners", at(19, 45), at(21, 45), 4, [2]],
  ];

  // Everything that hangs directly off the event. The default screens are the same ones a
  // real "Create event" produces. "Vendor Stalls" is the composed-tier test case: one
  // user-built screen that makes the vendor page, the run of show and the budget all
  // richer, without any of them knowing it exists.
  const [screenRows, lineRows, blockRows, shiftRows] = await Promise.all([
    prisma.screenDefinition.createManyAndReturn({
      data: [
        ...DEFAULT_SCREENS.map((spec, i) => ({
          eventId: event.id,
          name: spec.name,
          viewType: spec.viewType,
          position: i,
          isSystem: true,
          createdById: ownerId,
        })),
        { eventId: event.id, name: "Vendor Stalls", viewType: "TABLE", position: DEFAULT_SCREENS.length, createdById: ownerId },
      ],
    }),
    prisma.budgetLine.createManyAndReturn({
      data: budgetSpec.map(([, category, allocated]) => ({
        eventId: event.id,
        category,
        allocatedAmount: allocated,
        createdAt: stamp(),
      })),
    }),
    prisma.scheduleItem.createManyAndReturn({
      data: blocks.map((b) => ({
        eventId: event.id,
        title: b.title,
        location: b.location,
        startTime: b.start,
        endTime: b.end,
        createdAt: stamp(),
      })),
    }),
    prisma.shift.createManyAndReturn({
      data: shiftSpec.map(([title, startTime, endTime, capacity]) => ({
        eventId: event.id,
        title,
        startTime,
        endTime,
        capacity,
        createdAt: stamp(),
      })),
    }),
  ]);
  const screens = byKey(screenRows, "name");
  const lineByCategory = byKey(lineRows, "category");
  const budget = Object.fromEntries(budgetSpec.map(([key, category]) => [key, lineByCategory[category]]));
  const blockByTitle = byKey(blockRows, "title");
  const shiftByTitle = byKey(shiftRows, "title");
  // Also the earliest timed block, which the Files sample attaches to.
  const loadIn = blockByTitle["Vendor load-in"];

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

  const stallFields = [
    { key: "stall", label: "Stall name", type: "TEXT", position: 0, required: true },
    { key: "vendor", label: "Vendor", type: "LINK", position: 1, options: { targetType: "VENDOR", allowMultiple: false } },
    { key: "slot", label: "Setup slot", type: "LINK", position: 2, options: { targetType: "SCHEDULE_ITEM", allowMultiple: false } },
    // Rollup: this column's sum posts to the Food budget line as committed spend.
    { key: "fee", label: "Fee", type: "CURRENCY", position: 3, rollupTarget: budget.food.id },
    // Rollup: these records project onto the run-of-show timeline.
    { key: "setup_at", label: "Setup at", type: "DATETIME", position: 4, rollupTarget: "RUN_OF_SHOW" },
    { key: "permit", label: "Permit received", type: "CHECKBOX", position: 5 },
  ];

  // Everything that needs those ids.
  const [, , vendorRows] = await Promise.all([
    prisma.fieldDefinition.createMany({
      data: [
        ...DEFAULT_SCREENS.flatMap((spec) =>
          spec.fields.map((f, position) => ({
            screenId: screens[spec.name].id,
            key: f.key,
            label: f.label,
            type: f.type,
            position,
            required: f.required ?? false,
            options: f.options,
          })),
        ),
        ...stallFields.map((f) => ({ screenId: screens["Vendor Stalls"].id, ...f })),
      ],
    }),
    prisma.budgetLineItem.createMany({
      data: budgetSpec.flatMap(([key, , , items]) =>
        items.map(([name, planned, actual], position) => ({
          budgetLineId: budget[key].id,
          name,
          plannedAmount: planned,
          actualAmount: actual,
          position,
        })),
      ),
    }),
    prisma.vendor.createManyAndReturn({
      data: budgetSpec.map(([key, , , , [vName, vEmail, vPhone, vStatus, contactedDaysAgo]]) => ({
        budgetLineId: budget[key].id,
        name: vName,
        contactEmail: vEmail,
        contactPhone: vPhone,
        status: vStatus,
        lastContactedAt: contactedDaysAgo === null ? null : dayOffset(-contactedDaysAgo),
        createdAt: stamp(),
      })),
    }),
    prisma.registrant.createMany({
      data: guests.map(([name, paymentStatus, amount]) => ({
        eventId: event.id,
        name,
        email: `${name.split(" ")[0].toLowerCase()}${DEMO_DOMAIN}`,
        amount,
        paymentStatus,
        // Paid registrations post against Food, so the ledger shows the linkage.
        budgetLineId: paymentStatus === "PAID" ? budget.food.id : null,
        createdAt: stamp(),
      })),
    }),
    prisma.shiftSignup.createMany({
      data: shiftSpec.flatMap(([title, , , , who]) =>
        who.map((i) => ({ shiftId: shiftByTitle[title].id, volunteerId: volunteers[i].id })),
      ),
    }),
  ]);
  const vendorIdByName = new Map(vendorRows.map((v) => [v.name, v.id]));

  // Every record (tasks, files, stalls) goes in one batch, each carrying the links it needs.
  const records = [];
  const addRecord = (screenName, values, links) => {
    const screenId = screens[screenName].id;
    const position = records.filter((r) => r.screenId === screenId).length;
    records.push({ screenId, position, values, links });
  };

  // Tasks are checklist records now — identical to rows a user would add by hand.
  for (const block of blocks) {
    const created = blockByTitle[block.title];
    for (const task of block.tasks) {
      const budgetId = task.budget ? budget[task.budget].id : null;
      const links = [{ fieldKey: "block", targetType: "SCHEDULE_ITEM", targetId: created.id }];
      if (task.assignee) links.push({ fieldKey: "owner", targetType: "TEAM_MEMBER", targetId: task.assignee.id });
      if (budgetId) links.push({ fieldKey: "budget", targetType: "BUDGET_LINE", targetId: budgetId });
      addRecord(
        "Tasks",
        {
          title: task.title,
          done: task.status === "DONE",
          due: task.due ? task.due.toISOString().slice(0, 10) : null,
          owner: task.assignee?.id ?? null,
          block: created.id,
          budget: budgetId,
        },
        links,
      );
    }
  }

  for (const [name, location, url, assignee, attach] of [
    ["Signed venue contract", "Shared drive / Contracts", "https://example.org/contract", priya, { budget: budget.venue.id }],
    ["Run sheet template", "Shared drive / Templates", "https://example.org/runsheet", null, {}],
    ["Centrepieces & linens", "Storage room B", null, marcus, { block: loadIn.id }],
  ]) {
    const links = [];
    if (assignee) links.push({ fieldKey: "owner", targetType: "TEAM_MEMBER", targetId: assignee.id });
    if (attach.block) links.push({ fieldKey: "block", targetType: "SCHEDULE_ITEM", targetId: attach.block });
    if (attach.budget) links.push({ fieldKey: "budget", targetType: "BUDGET_LINE", targetId: attach.budget });
    addRecord(
      "Files",
      {
        name,
        location,
        link: url,
        notes: null,
        owner: assignee ? assignee.id : null,
        block: attach.block || null,
        budget: attach.budget || null,
      },
      links,
    );
  }

  for (const [stall, vendorName, fee, permit, setupAt] of [
    ["Hot food — north aisle", "Acme Catering", 450, true, at(15, 30)],
    // Deliberately inside the 19:00-20:00 gap, to show a projection does not make an
    // unscheduled hour look accounted for.
    ["Sound & staging", "Northside AV", 900, false, at(19, 30)],
    ["Flowers & greenery", "Bloom & Vine", 300, false, null],
  ]) {
    const vendorId = vendorIdByName.get(vendorName) || null;
    const links = [{ fieldKey: "slot", targetType: "SCHEDULE_ITEM", targetId: loadIn.id }];
    if (vendorId) links.unshift({ fieldKey: "vendor", targetType: "VENDOR", targetId: vendorId });
    addRecord(
      "Vendor Stalls",
      { stall, vendor: vendorId, slot: loadIn.id, fee, permit, setup_at: setupAt ? setupAt.toISOString() : null },
      links,
    );
  }

  const recordRows = await prisma.screenRecord.createManyAndReturn({
    data: records.map(({ screenId, position, values }) => ({ screenId, position, values })),
  });
  // Screen plus position is unique among these records, so it matches the rows back.
  const recordIds = new Map(recordRows.map((r) => [`${r.screenId}:${r.position}`, r.id]));
  await prisma.recordLink.createMany({
    data: records.flatMap((r) =>
      r.links.map((l) => ({ recordId: recordIds.get(`${r.screenId}:${r.position}`), ...l })),
    ),
  });

  return event;
}

module.exports = { seedDemoEvent, EVENT_SUFFIX, DEMO_DOMAIN };
