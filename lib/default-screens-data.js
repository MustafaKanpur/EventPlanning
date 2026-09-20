/*
 * CommonJS mirror of DEFAULT_SCREENS for scripts that run outside the TypeScript
 * pipeline (prisma/demo-seed.js). Keep in step with lib/default-screens.ts.
 */
const DEFAULT_SCREENS = [
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

module.exports = { DEFAULT_SCREENS };
