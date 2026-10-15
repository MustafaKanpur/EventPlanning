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

  const people = [];
  for (const [name, role, phone] of [
    ["Priya Raman", "ORGANIZER", "+1 555 0142"],
    ["Marcus Bell", "STAFF", "+1 555 0177"],
    ["Yuki Tanaka", "STAFF", null],
  ]) {
    const email = `${name.split(" ")[0].toLowerCase()}${tag}${DEMO_DOMAIN}`;
    people.push(
      await prisma.teamMember.upsert({
        where: { email },
        update: { name, role, phone },
        create: { name, email, role, phone, isDemo },
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
      ownerId,
      isDemo,
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
        createdById: ownerId,
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
      createdById: ownerId,
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

  // Volunteers and shifts, so the volunteer features have something to show.
  const volunteers = [];
  for (const [name, status] of [
    ["Amara Osei", "APPROVED"],
    ["Liam Novak", "APPROVED"],
    ["Sofia Russo", "APPROVED"],
    ["Ben Carter", "PENDING"],
  ]) {
    const email = `${name.split(" ")[0].toLowerCase()}${tag}${DEMO_DOMAIN}`;
    volunteers.push(
      await prisma.volunteer.upsert({ where: { email }, update: {}, create: { name, email, status, isDemo } }),
    );
  }
  const shifts = [
    ["Registration desk", at(15, 30), at(18, 0), 3, [0, 1]],
    ["Auction runners", at(19, 45), at(21, 45), 4, [2]],
  ];
  for (const [title, startTime, endTime, capacity, who] of shifts) {
    await prisma.shift.create({
      data: {
        eventId: event.id,
        title,
        startTime,
        endTime,
        capacity,
        signups: { create: who.map((i) => ({ volunteerId: volunteers[i].id })) },
      },
    });
  }

  return event;
}

module.exports = { seedDemoEvent, EVENT_SUFFIX, DEMO_DOMAIN };
