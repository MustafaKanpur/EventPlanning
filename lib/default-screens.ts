import type { Prisma } from "@prisma/client";

import { DEFAULT_SCREENS as DEFAULT_SCREEN_DATA } from "./default-screens-data.js";

/**
 * The screens every new event starts with. These are ordinary composed screens — the
 * same thing a user builds — marked `isSystem` only so the UI can say "default screen".
 * A team can add fields to them, change the view type, or delete them outright.
 *
 * The data lives in default-screens-data.js so the plain-Node demo seed can require it;
 * this file only adds the types.
 */
type DefaultScreen = {
  name: string;
  viewType: "TABLE" | "CHECKLIST";
  fields: {
    key: string;
    label: string;
    type: Prisma.FieldDefinitionCreateWithoutScreenInput["type"];
    required?: boolean;
    options?: Prisma.InputJsonValue;
  }[];
};

// ponytail: cast trusts the .js data; enum typos there surface at seed time, not tsc.
export const DEFAULT_SCREENS = DEFAULT_SCREEN_DATA as DefaultScreen[];

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
