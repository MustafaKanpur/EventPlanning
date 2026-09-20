import type { FieldType } from "@prisma/client";

export type SelectOption = { value: string; label: string; color: string };

export type TemplateField = {
  label: string;
  type: FieldType;
  options?: SelectOption[];
};

export type ScreenTemplate = {
  id: string;
  name: string;
  description: string;
  fields: TemplateField[];
};

// Field-option colors are drawn from this fixed palette so every SELECT field
// (template-seeded or built from scratch) looks consistent.
export const OPTION_COLORS = [
  "gray",
  "blue",
  "green",
  "amber",
  "red",
  "purple",
] as const;

function statusOptions(labels: string[]): SelectOption[] {
  return labels.map((label, i) => ({
    value: label.toLowerCase().replace(/\s+/g, "-"),
    label,
    color: OPTION_COLORS[i % OPTION_COLORS.length],
  }));
}

export const SCREEN_TEMPLATES: ScreenTemplate[] = [
  {
    id: "resource-tracking",
    name: "Resource Tracking",
    description: "A punch list of reference material — contracts, forms, shared docs.",
    fields: [
      { label: "Title", type: "TEXT" },
      { label: "Location", type: "TEXT" },
      { label: "Link", type: "URL" },
      { label: "Additional notes", type: "LONG_TEXT" },
      {
        label: "Status",
        type: "SELECT",
        options: statusOptions(["Not started", "In progress", "Done"]),
      },
    ],
  },
  {
    id: "vendor-tracking",
    name: "Vendor Tracking",
    description: "Track outreach to caterers, AV, decor, and other vendors.",
    fields: [
      { label: "Vendor Name", type: "TEXT" },
      {
        label: "Category",
        type: "SELECT",
        options: statusOptions(["Catering", "AV", "Decor", "Photography", "Other"]),
      },
      { label: "Contact Email", type: "EMAIL" },
      { label: "Contact Phone", type: "TEXT" },
      {
        label: "Status",
        type: "SELECT",
        options: statusOptions(["To Contact", "Negotiating", "Booked", "Declined"]),
      },
      { label: "Additional notes", type: "LONG_TEXT" },
    ],
  },
  {
    id: "permit-tracking",
    name: "Permit Tracking",
    description: "Every permit an event needs, who issues it, and where it stands.",
    fields: [
      { label: "Permit Name", type: "TEXT" },
      { label: "Issuing Authority", type: "TEXT" },
      { label: "Due Date", type: "DATE" },
      {
        label: "Status",
        type: "SELECT",
        options: statusOptions(["Not Started", "Submitted", "Approved", "Denied"]),
      },
      { label: "Cost", type: "NUMBER" },
      { label: "Additional notes", type: "LONG_TEXT" },
    ],
  },
];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  TEXT: "Text",
  LONG_TEXT: "Long text",
  NUMBER: "Number",
  CURRENCY: "Currency",
  DATE: "Date",
  DATETIME: "Date & time",
  DURATION: "Duration",
  CHECKBOX: "Checkbox",
  SELECT: "Select / Status",
  MULTI_SELECT: "Multi-select",
  LINK: "Link to…",
  EMAIL: "Email",
  URL: "URL",
  PERSON: "Person",
};

/** The builder's two groups. Connections are the differentiator, so they stand apart. */
export const FIELD_GROUPS: { label: string; types: FieldType[] }[] = [
  {
    label: "Content",
    types: ["TEXT", "LONG_TEXT", "NUMBER", "CURRENCY", "DATE", "DATETIME", "DURATION", "CHECKBOX", "SELECT", "MULTI_SELECT"],
  },
  { label: "Connections", types: ["LINK", "PERSON", "EMAIL", "URL"] },
];

// Tailwind classes for each named color — used when rendering SELECT values as pills
// wherever a screen's data is shown. Pale by design: these sit behind dark label text.
export const OPTION_COLOR_CLASSES: Record<string, string> = {
  gray: "bg-gray-100 text-gray-600",
  blue: "bg-blue-100 text-blue-700",
  green: "bg-green-100 text-green-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
  purple: "bg-purple-100 text-purple-700",
};

// Saturated fills for the builder's colour picker. The picker previously reused the pill
// classes above, whose `bg-*-100` tints are all but invisible as bare circles on white —
// so the swatches need their own, much stronger, palette.
export const OPTION_SWATCH_CLASSES: Record<string, string> = {
  gray: "bg-gray-400",
  blue: "bg-blue-500",
  green: "bg-green-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  purple: "bg-purple-500",
};

export const FIELD_TYPES: FieldType[] = FIELD_GROUPS.flatMap((g) => g.types);

// Per-type input guidance, shared by the builder preview and the record forms so an
// example and its limit can never drift apart. `maxLength` also drives the live
// character counter; types without one have no meaningful text limit.
export type FieldTypeMeta = {
  placeholder: string;
  maxLength?: number;
  /** Second input's placeholder — only LINK (URL) collects two values. */
  urlPlaceholder?: string;
};

export const FIELD_TYPE_META: Record<FieldType, FieldTypeMeta> = {
  CURRENCY: { placeholder: "e.g. 1250.00" },
  DATETIME: { placeholder: "" },
  DURATION: { placeholder: "e.g. 45 (minutes)" },
  MULTI_SELECT: { placeholder: "" },
  LINK: { placeholder: "" },
  PERSON: { placeholder: "" },
  TEXT: { placeholder: "e.g. Fire Marshal Permit", maxLength: 200 },
  LONG_TEXT: {
    placeholder: "e.g. Submit at least 30 days before the event date",
    maxLength: 2000,
  },
  NUMBER: { placeholder: "e.g. 1250.00" },
  DATE: { placeholder: "" }, // native date picker supplies its own affordance
  CHECKBOX: { placeholder: "" },
  SELECT: { placeholder: "" },
  URL: {
    placeholder: "e.g. Venue contract",
    maxLength: 200,
    urlPlaceholder: "https://drive.google.com/…",
  },
  EMAIL: { placeholder: "e.g. jordan@organization.org", maxLength: 200 },
};

// A LINK field stores display text and destination separately so the record renders a
// proper hyperlink rather than a bare URL. Values written before that change were plain
// strings, so reads coerce them rather than dropping them.
export type LinkValue = { text: string; url: string };

export function readLinkValue(value: unknown): LinkValue {
  if (value && typeof value === "object" && "url" in value) {
    const link = value as Partial<LinkValue>;
    return { text: link.text ?? "", url: link.url ?? "" };
  }
  if (typeof value === "string") return { text: value, url: value };
  return { text: "", url: "" };
}
