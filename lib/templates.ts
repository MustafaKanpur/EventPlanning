import type { FieldType, Prisma, ViewType } from "@prisma/client";

import { prisma } from "./prisma";
import { DEFAULT_SCREENS } from "./default-screens";

type FieldSpec = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: Prisma.InputJsonValue;
};

type ScreenSpec = { name: string; viewType: ViewType; fields: FieldSpec[] };

type TemplateSpec = {
  slug: string;
  name: string;
  description: string;
  /** Screens beyond the defaults (Tasks and Files) that every event gets. */
  screens: ScreenSpec[];
};

const choices = (...labels: string[]): Prisma.InputJsonValue => ({
  choices: labels.map((label, i) => ({
    value: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    label,
    color: ["gray", "blue", "amber", "green", "red", "purple"][i % 6],
  })),
});

const person = (): Prisma.InputJsonValue => ({
  targetType: "TEAM_MEMBER",
  allowMultiple: false,
});
const linkTo = (target: string): Prisma.InputJsonValue => ({
  targetType: target,
  allowMultiple: false,
});

/**
 * The four shipped templates. Each is the default screens plus the handful a particular
 * kind of event actually runs on — a festival needs stalls and permits, a conference
 * needs sessions and speakers. Held in code and materialised into Template rows on
 * demand, so editing this file is how a built-in changes.
 */
export const TEMPLATE_BLUEPRINTS: TemplateSpec[] = [
  {
    slug: "gala-dinner",
    name: "Gala / Dinner",
    description: "Seated fundraising dinner: tables, programme and a run of show.",
    screens: [
      {
        name: "Table Seating",
        viewType: "TABLE",
        fields: [
          { key: "table", label: "Table", type: "TEXT", required: true },
          { key: "host", label: "Host", type: "PERSON", options: person() },
          { key: "seats", label: "Seats", type: "NUMBER" },
          { key: "guest", label: "Lead guest", type: "LINK", options: linkTo("REGISTRANT") },
          { key: "notes", label: "Notes", type: "LONG_TEXT" },
        ],
      },
      {
        name: "Programme",
        viewType: "TIMELINE",
        fields: [
          { key: "item", label: "Item", type: "TEXT", required: true },
          { key: "at", label: "At", type: "DATETIME" },
          { key: "who", label: "Who", type: "PERSON", options: person() },
          { key: "block", label: "Block", type: "LINK", options: linkTo("SCHEDULE_ITEM") },
        ],
      },
    ],
  },
  {
    slug: "conference",
    name: "Conference",
    description: "Multi-session day: sessions, speakers and rooms.",
    screens: [
      {
        name: "Sessions",
        viewType: "TIMELINE",
        fields: [
          { key: "title", label: "Session", type: "TEXT", required: true },
          { key: "starts", label: "Starts", type: "DATETIME" },
          { key: "room", label: "Room", type: "TEXT" },
          { key: "track", label: "Track", type: "SELECT", options: choices("Main", "Workshop", "Lightning") },
          { key: "block", label: "Block", type: "LINK", options: linkTo("SCHEDULE_ITEM") },
        ],
      },
      {
        name: "Speakers",
        viewType: "BOARD",
        fields: [
          { key: "name", label: "Speaker", type: "TEXT", required: true },
          {
            key: "status",
            label: "Status",
            type: "SELECT",
            options: choices("Invited", "Confirmed", "Travel booked", "Declined"),
          },
          { key: "email", label: "Email", type: "EMAIL" },
          { key: "fee", label: "Fee", type: "CURRENCY" },
        ],
      },
    ],
  },
  {
    slug: "festival-market",
    name: "Festival / Market",
    description: "Outdoor event with traders: stalls, permits and load-in.",
    screens: [
      {
        name: "Vendor Stalls",
        viewType: "TABLE",
        fields: [
          { key: "stall", label: "Stall name", type: "TEXT", required: true },
          { key: "vendor", label: "Vendor", type: "LINK", options: linkTo("VENDOR") },
          { key: "slot", label: "Setup slot", type: "LINK", options: linkTo("SCHEDULE_ITEM") },
          { key: "fee", label: "Fee", type: "CURRENCY" },
          { key: "permit", label: "Permit received", type: "CHECKBOX" },
        ],
      },
      {
        name: "Permits",
        viewType: "CHECKLIST",
        fields: [
          { key: "permit", label: "Permit", type: "TEXT", required: true },
          { key: "granted", label: "Granted", type: "CHECKBOX" },
          { key: "due", label: "Due", type: "DATE" },
          { key: "authority", label: "Issuing authority", type: "TEXT" },
          { key: "cost", label: "Cost", type: "CURRENCY" },
          { key: "owner", label: "Owner", type: "PERSON", options: person() },
        ],
      },
    ],
  },
  {
    slug: "fundraising-campaign",
    name: "Fundraising Campaign",
    description: "Appeal rather than a single day: asks, pledges and donor follow-up.",
    screens: [
      {
        name: "Major Asks",
        viewType: "BOARD",
        fields: [
          { key: "donor", label: "Donor", type: "TEXT", required: true },
          {
            key: "stage",
            label: "Stage",
            type: "SELECT",
            options: choices("Researching", "Approached", "Meeting set", "Pledged", "Declined"),
          },
          { key: "target", label: "Target", type: "CURRENCY" },
          { key: "owner", label: "Owner", type: "PERSON", options: person() },
          { key: "next", label: "Next step by", type: "DATE" },
        ],
      },
      {
        name: "Pledges",
        viewType: "LEDGER",
        fields: [
          { key: "donor", label: "Donor", type: "TEXT", required: true },
          { key: "pledged", label: "Pledged", type: "CURRENCY" },
          { key: "received", label: "Received", type: "CURRENCY" },
          { key: "due", label: "Due", type: "DATE" },
        ],
      },
    ],
  },
];

/** Every template's full screen list: the shared defaults, then its speciality screens. */
function screensFor(spec: TemplateSpec): ScreenSpec[] {
  const defaults: ScreenSpec[] = DEFAULT_SCREENS.map((screen) => ({
    name: screen.name,
    viewType: screen.viewType as ViewType,
    fields: screen.fields.map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required,
      options: f.options,
    })),
  }));
  return [...defaults, ...spec.screens];
}

/**
 * Materialises the built-ins into the database, idempotently. Called before anything
 * lists or uses templates, so a fresh deploy has them without a seed step — and editing
 * a blueprint updates the stored copy on the next request rather than duplicating it.
 */
export async function ensureBuiltInTemplates(): Promise<void> {
  for (const spec of TEMPLATE_BLUEPRINTS) {
    const existing = await prisma.template.findUnique({ where: { slug: spec.slug } });

    if (existing) {
      // Rebuild the screens so a blueprint edit propagates. Safe because a template
      // holds no records — only shapes.
      await prisma.$transaction(async (tx) => {
        await tx.template.update({
          where: { id: existing.id },
          data: { name: spec.name, description: spec.description },
        });
        await tx.screenDefinition.deleteMany({ where: { templateId: existing.id } });
        await createTemplateScreens(tx, existing.id, screensFor(spec));
      });
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const template = await tx.template.create({
        data: {
          slug: spec.slug,
          name: spec.name,
          description: spec.description,
          isBuiltIn: true,
        },
      });
      await createTemplateScreens(tx, template.id, screensFor(spec));
    });
  }
}

async function createTemplateScreens(
  tx: Prisma.TransactionClient,
  templateId: string,
  screens: ScreenSpec[],
) {
  for (let i = 0; i < screens.length; i++) {
    const screen = screens[i];
    await tx.screenDefinition.create({
      data: {
        templateId,
        eventId: null, // template-level: a shape with no event and no records
        name: screen.name,
        viewType: screen.viewType,
        position: i,
        isSystem: i < DEFAULT_SCREENS.length,
        fields: {
          create: screen.fields.map((f, position) => ({
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
}

/**
 * Copies a template's screens onto a new event. Fields keep their keys, so a record
 * written on one event is shaped identically to the same screen on another.
 */
export async function applyTemplateToEvent(
  tx: Prisma.TransactionClient,
  templateId: string,
  eventId: string,
  createdById?: string | null,
) {
  const screens = await tx.screenDefinition.findMany({
    where: { templateId },
    include: { fields: { orderBy: { position: "asc" } } },
    orderBy: { position: "asc" },
  });

  for (const screen of screens) {
    await tx.screenDefinition.create({
      data: {
        eventId,
        name: screen.name,
        icon: screen.icon,
        viewType: screen.viewType,
        groupByFieldKey: screen.groupByFieldKey,
        position: screen.position,
        isSystem: screen.isSystem,
        createdById: createdById ?? null,
        fields: {
          create: screen.fields.map((f) => ({
            key: f.key,
            label: f.label,
            type: f.type,
            position: f.position,
            required: f.required,
            options: f.options === null ? undefined : (f.options as Prisma.InputJsonValue),
            // Rollup targets point at this template's own ids, which mean nothing on a
            // new event. The run-of-show projection is the exception: it is a constant.
            rollupTarget: f.rollupTarget === "RUN_OF_SHOW" ? "RUN_OF_SHOW" : null,
          })),
        },
      },
    });
  }
}

/** "Save this event as a template": copies its screens, strips every record. */
export async function saveEventAsTemplate(
  eventId: string,
  name: string,
  description: string | null,
  createdById: string | null,
): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const screens = await tx.screenDefinition.findMany({
      where: { eventId, isDraft: false },
      include: { fields: { orderBy: { position: "asc" } } },
      orderBy: { position: "asc" },
    });

    const template = await tx.template.create({
      data: { name, description, isBuiltIn: false, createdById },
    });

    for (const screen of screens) {
      await tx.screenDefinition.create({
        data: {
          templateId: template.id,
          eventId: null,
          name: screen.name,
          icon: screen.icon,
          viewType: screen.viewType,
          groupByFieldKey: screen.groupByFieldKey,
          position: screen.position,
          isSystem: screen.isSystem,
          fields: {
            create: screen.fields.map((f) => ({
              key: f.key,
              label: f.label,
              type: f.type,
              position: f.position,
              required: f.required,
              options: f.options === null ? undefined : (f.options as Prisma.InputJsonValue),
              rollupTarget: f.rollupTarget === "RUN_OF_SHOW" ? "RUN_OF_SHOW" : null,
            })),
          },
        },
      });
    }

    return template.id;
  });
}
