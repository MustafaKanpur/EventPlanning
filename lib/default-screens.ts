import type { Prisma } from "@prisma/client";

/**
 * The screens every new event starts with. These are ordinary composed screens — the
 * same thing a user builds — marked `isSystem` only so the UI can say "default screen".
 * A team can add fields to them, change the view type, or delete them outright.
 *
 * Kept in one place so event creation, the migration that seeded existing events, and
 * the demo seed all produce identical screens.
 */
export const DEFAULT_SCREENS: {
  name: string;
  viewType: "TABLE" | "CHECKLIST";
  fields: {
    key: string;
    label: string;
    type: Prisma.FieldDefinitionCreateWithoutScreenInput["type"];
    required?: boolean;
    options?: Prisma.InputJsonValue;
  }[];
}[] = [
  {
    name: "Tasks",
    viewType: "CHECKLIST",
    fields: [
      { key: "title", label: "Title", type: "TEXT", required: true },
      { key: "done", label: "Done", type: "CHECKBOX" },
      { key: "due", label: "Due", type: "DATE" },
      {
        key: "owner",
        label: "Owner",
        type: "PERSON",
        options: { targetType: "TEAM_MEMBER", allowMultiple: false },
      },
      {
        key: "block",
        label: "Block",
        type: "LINK",
        options: { targetType: "SCHEDULE_ITEM", allowMultiple: false },
      },
      {
        key: "budget",
        label: "Budget line",
        type: "LINK",
        options: { targetType: "BUDGET_LINE", allowMultiple: false },
      },
    ],
  },
  {
    name: "Files",
    viewType: "TABLE",
    fields: [
      { key: "name", label: "Name", type: "TEXT", required: true },
      { key: "location", label: "Location", type: "TEXT" },
      { key: "link", label: "Link", type: "URL" },
      { key: "notes", label: "Notes", type: "LONG_TEXT" },
      {
        key: "owner",
        label: "Added for",
        type: "PERSON",
        options: { targetType: "TEAM_MEMBER", allowMultiple: false },
      },
      {
        key: "block",
        label: "Block",
        type: "LINK",
        options: { targetType: "SCHEDULE_ITEM", allowMultiple: false },
      },
      {
        key: "budget",
        label: "Budget line",
        type: "LINK",
        options: { targetType: "BUDGET_LINE", allowMultiple: false },
      },
    ],
  },
];

/** Creates the default screen set for a newly made event. */
export async function seedDefaultScreens(
  tx: Prisma.TransactionClient,
  eventId: string,
  createdById?: string | null,
) {
  for (let i = 0; i < DEFAULT_SCREENS.length; i++) {
    const screen = DEFAULT_SCREENS[i];
    await tx.screenDefinition.create({
      data: {
        eventId,
        name: screen.name,
        viewType: screen.viewType,
        position: i,
        isSystem: true,
        createdById: createdById ?? null,
        fields: {
          create: screen.fields.map((field, position) => ({
            key: field.key,
            label: field.label,
            type: field.type,
            position,
            required: field.required ?? false,
            options: field.options,
          })),
        },
      },
    });
  }
}
