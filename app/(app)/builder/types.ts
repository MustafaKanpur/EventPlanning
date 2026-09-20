import type { FieldType, LinkTarget, ViewType } from "@prisma/client";
import type { SelectOption } from "@/lib/screen-templates";

/**
 * `key` is the client-side identity of a row while editing. On save the server turns it
 * into the field's immutable storage key (slug of the label), which is what record
 * values are keyed by. `id` is present only for fields that already exist.
 */
export type BuilderField = {
  key: string;
  id?: string;
  label: string;
  type: FieldType;
  options?: SelectOption[];
  required: boolean;
  /** LINK/PERSON: which core object this points at. */
  targetType?: LinkTarget;
  /** CURRENCY: a budget line id. DATE/DATETIME: "RUN_OF_SHOW". Null means no rollup. */
  rollupTarget?: string | null;
};

export type BuilderScreenInput = {
  eventId: string;
  name: string;
  icon?: string | null;
  viewType: ViewType;
  /** BOARD only: which SELECT field's options become the columns. */
  groupByFieldKey?: string | null;
  fields: BuilderField[];
};
