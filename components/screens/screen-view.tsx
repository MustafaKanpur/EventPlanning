import type { FieldDefinition, ScreenDefinition, ScreenRecord } from "@prisma/client";

import {
  checklistProgress,
  checklistShape,
  daysOverdue,
  isRecordOverdue,
  readText,
  titleKeyOf,
  valuesOf,
} from "@/lib/records";
import type { LinkOption } from "@/lib/link-targets";
import { linkTargetOf } from "@/lib/records";
import { MicroBar } from "@/components/ui";
import {
  choicesOf,
  currencyFields,
  dateField as findDateField,
  groupField as findGroupField,
  missingRequirement,
  parseMonth,
} from "@/lib/screen-views";
import { Cell } from "./cell";
import { LinkPicker } from "./link-picker";
import { BoardView } from "./board-view";
import { CalendarView, LedgerView, TimelineView } from "./date-views";
import {
  addFieldToScreen,
  createRecord,
  deleteRecord,
} from "@/app/(app)/events/[eventId]/screens/actions";

export type RenderableScreen = ScreenDefinition & {
  fields: FieldDefinition[];
  records: ScreenRecord[];
};

const field =
  "w-full border border-rule bg-panel px-3 py-2 text-[13px] text-ink focus:border-accent focus:outline-none";

/**
 * Renders a composed screen according to its view type. TABLE and CHECKLIST are built;
 * BOARD, TIMELINE, CALENDAR and LEDGER land in step 4 and fall back to TABLE until then,
 * which is always a correct if plainer rendering of the same records.
 */
export type LinkOptionsByTarget = Record<string, LinkOption[]>;

export function ScreenView({
  eventId,
  screen,
  linkOptions = {},
  month,
  basePath,
}: {
  eventId: string;
  screen: RenderableScreen;
  linkOptions?: LinkOptionsByTarget;
  /** CALENDAR only: the month being shown, from the URL. */
  month?: string;
  basePath?: string;
}) {
  // A view type that needs a field it doesn't have offers to create it, rather than
  // refusing to render or silently falling back to something else.
  const missing = missingRequirement(screen.viewType, screen.fields);
  if (missing) {
    return (
      <MissingFieldPrompt eventId={eventId} screen={screen} requirement={missing} />
    );
  }

  switch (screen.viewType) {
    case "CHECKLIST":
      return <ChecklistView eventId={eventId} screen={screen} linkOptions={linkOptions} />;
    case "BOARD": {
      const group = findGroupField(screen.fields, screen.groupByFieldKey)!;
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-meta text-ink-muted">
              Grouped by <span className="text-ink">{group.label}</span>
            </p>
            <AddRecordForm eventId={eventId} screen={screen} linkOptions={linkOptions} label="+ Add card" />
          </div>
          <BoardView
            eventId={eventId}
            records={screen.records}
            groupField={group}
            choices={choicesOf(group)}
            cardFields={screen.fields.filter((f) => f.key !== group.key).slice(0, 3)}
          />
        </div>
      );
    }
    case "TIMELINE": {
      const when = findDateField(screen.fields)!;
      return (
        <div className="space-y-4">
          <div className="flex justify-end">
            <AddRecordForm eventId={eventId} screen={screen} linkOptions={linkOptions} label="+ Add entry" />
          </div>
          <TimelineView records={screen.records} fields={screen.fields} dateField={when} />
        </div>
      );
    }
    case "CALENDAR": {
      const when = findDateField(screen.fields)!;
      return (
        <div className="space-y-4">
          <div className="flex justify-end">
            <AddRecordForm eventId={eventId} screen={screen} linkOptions={linkOptions} label="+ Add entry" />
          </div>
          <CalendarView
            records={screen.records}
            fields={screen.fields}
            dateField={when}
            month={parseMonth(month, new Date())}
            basePath={basePath ?? ""}
          />
        </div>
      );
    }
    case "LEDGER":
      return (
        <div className="space-y-4">
          <div className="flex justify-end">
            <AddRecordForm eventId={eventId} screen={screen} linkOptions={linkOptions} label="+ Add entry" />
          </div>
          <LedgerView
            records={screen.records}
            fields={screen.fields}
            currencyKeys={currencyFields(screen.fields).map((f) => f.key)}
          />
        </div>
      );
    default:
      return <TableView eventId={eventId} screen={screen} linkOptions={linkOptions} />;
  }
}

function MissingFieldPrompt({
  eventId,
  screen,
  requirement,
}: {
  eventId: string;
  screen: RenderableScreen;
  requirement: NonNullable<ReturnType<typeof missingRequirement>>;
}) {
  const add = addFieldToScreen.bind(
    null,
    eventId,
    screen.id,
    requirement.suggestLabel,
    requirement.suggestType,
  );
  return (
    <div className="border border-rule bg-panel px-4 py-8">
      <p className="text-[13px] text-ink">
        A {screen.viewType.toLowerCase()} needs {requirement.need}.
      </p>
      <form action={add} className="mt-3">
        <button
          type="submit"
          className="h-11 bg-accent px-4 text-ui text-panel transition-opacity hover:opacity-90"
        >
          Add a “{requirement.suggestLabel}” field
        </button>
      </form>
      <p className="mt-2 text-meta text-ink-muted">
        Or switch the view type back in{" "}
        <a href={`/builder/${screen.id}/edit`} className="text-accent hover:underline">
          the builder
        </a>
        .
      </p>
    </div>
  );
}

/** Options for one field, resolved from its configured target type. */
function optionsFor(field: FieldDefinition, linkOptions: LinkOptionsByTarget): LinkOption[] {
  const target = linkTargetOf(field);
  return target ? (linkOptions[target] ?? []) : [];
}

function AddRecordForm({
  eventId,
  screen,
  linkOptions,
  label = "+ Add row",
}: {
  eventId: string;
  screen: RenderableScreen;
  linkOptions: LinkOptionsByTarget;
  label?: string;
}) {
  const add = createRecord.bind(null, eventId, screen.id);
  const editable = screen.fields;

  return (
    <details>
      <summary className="cursor-pointer list-none text-ui text-ink-muted transition-colors hover:text-ink">
        {label}
      </summary>
      <form action={add} className="mt-2 flex flex-wrap items-end gap-2 border border-rule bg-panel p-3">
        {editable.map((f) => (
          <div key={f.id} className="space-y-1">
            <label className="block text-caption text-ink-muted" htmlFor={`new-${screen.id}-${f.key}`}>
              {f.label}
            </label>
            {f.type === "LINK" || f.type === "PERSON" ? (
              <div className="w-44 border border-rule">
                <LinkPicker
                  options={optionsFor(f, linkOptions)}
                  value=""
                  name={f.key}
                  label={f.label}
                />
              </div>
            ) : f.type === "CHECKBOX" ? (
              <input
                id={`new-${screen.id}-${f.key}`}
                type="checkbox"
                name={f.key}
                className="h-11"
              />
            ) : (
              <input
                id={`new-${screen.id}-${f.key}`}
                name={f.key}
                required={f.required}
                type={
                  f.type === "DATE"
                    ? "date"
                    : f.type === "NUMBER" || f.type === "CURRENCY" || f.type === "DURATION"
                      ? "number"
                      : f.type === "EMAIL"
                        ? "email"
                        : f.type === "URL"
                          ? "url"
                          : "text"
                }
                step={f.type === "CURRENCY" ? "0.01" : undefined}
                className={`${field} w-40`}
              />
            )}
          </div>
        ))}
        <button
          type="submit"
          className="h-11 bg-accent px-4 text-ui text-panel transition-opacity hover:opacity-90"
        >
          Add
        </button>
      </form>
    </details>
  );
}

function TableView({
  eventId,
  screen,
  linkOptions,
}: {
  eventId: string;
  screen: RenderableScreen;
  linkOptions: LinkOptionsByTarget;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="font-mono text-meta tabular-nums text-ink-muted">
          {screen.records.length} row{screen.records.length === 1 ? "" : "s"}
        </p>
        <AddRecordForm eventId={eventId} screen={screen} linkOptions={linkOptions} />
      </div>

      <div className="overflow-x-auto border border-rule bg-panel">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="h-head border-b border-rule bg-panel-alt">
              {screen.fields.map((f) => (
                <th
                  key={f.id}
                  scope="col"
                  className={`px-2 text-micro font-medium uppercase text-ink-muted ${
                    f.type === "CURRENCY" || f.type === "NUMBER" ? "text-right" : "text-left"
                  }`}
                >
                  {f.label}
                </th>
              ))}
              <th scope="col" className="px-2 text-micro font-medium uppercase text-ink-muted">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule-soft">
            {screen.records.length === 0 ? (
              <tr>
                <td
                  colSpan={screen.fields.length + 1}
                  className="px-4 py-10 text-[13px] text-ink-muted"
                >
                  Nothing on this screen yet. Add the first row above.
                </td>
              </tr>
            ) : (
              screen.records.map((record) => {
                const values = valuesOf(record);
                const remove = deleteRecord.bind(null, eventId, record.id);
                return (
                  <tr key={record.id} className="align-middle">
                    {screen.fields.map((f) => (
                      <td key={f.id} className="px-2 py-1">
                        <Cell
                          eventId={eventId}
                          recordId={record.id}
                          field={f}
                          value={values[f.key]}
                          linkOptions={optionsFor(f, linkOptions)}
                        />
                      </td>
                    ))}
                    <td className="px-2 py-1 text-right">
                      <form action={remove}>
                        <button
                          type="submit"
                          className="h-11 px-2 text-meta text-ink-muted hover:text-danger"
                        >
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChecklistView({
  eventId,
  screen,
  linkOptions,
}: {
  eventId: string;
  screen: RenderableScreen;
  linkOptions: LinkOptionsByTarget;
}) {
  const shape = checklistShape(screen.fields);
  // A checklist with no checkbox can't be a checklist; show it as a table rather than
  // rendering something broken.
  if (!shape) return <TableView eventId={eventId} screen={screen} linkOptions={linkOptions} />;

  const titleKey = titleKeyOf(screen.fields);
  const titleField = screen.fields.find((f) => f.key === titleKey);
  const progress = checklistProgress(screen.records, shape);
  const doneField = screen.fields.find((f) => f.key === shape.doneKey)!;
  const detailFields = screen.fields.filter(
    (f) => f.key !== shape.doneKey && f.key !== titleKey,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[22px] leading-none tabular-nums text-ink">
            {progress.done}/{progress.total}
          </p>
          <p className="mt-1 text-meta text-ink-muted">complete</p>
          <MicroBar
            value={progress.done}
            max={progress.total || 1}
            color="accent"
            className="mt-2 w-48"
          />
        </div>
        <AddRecordForm eventId={eventId} screen={screen} linkOptions={linkOptions} label="+ Add item" />
      </div>

      <div className="border border-rule bg-panel">
        {screen.records.length === 0 ? (
          <p className="px-4 py-10 text-[13px] text-ink-muted">
            Nothing on this checklist yet. Add the first item above.
          </p>
        ) : (
          <ul className="divide-y divide-rule-soft">
            {/* Column headers. The widths mirror the row below exactly, including an
                invisible copy of the Delete label so the trailing column cannot drift
                out of alignment when that label changes. Hidden on narrow screens,
                where the row wraps and headers would line up with the wrong cells. */}
            <li
              aria-hidden="true"
              className="hidden h-head flex-wrap items-center gap-2 border-b border-rule bg-panel-alt px-2 sm:flex"
            >
              <span className="flex w-[60px] shrink-0 items-center px-2 text-micro uppercase text-ink-muted">
                {doneField.label}
              </span>
              <span className="min-w-[12rem] flex-1 text-micro uppercase text-ink-muted">
                {titleField?.label ?? "Item"}
              </span>
              {detailFields.map((f) => (
                <span
                  key={f.id}
                  className="w-36 shrink-0 px-2 text-micro uppercase text-ink-muted"
                >
                  {f.label}
                </span>
              ))}
              <span className="invisible shrink-0 px-2 text-meta">Delete</span>
            </li>

            {screen.records.map((record) => {
              const values = valuesOf(record);
              const overdue = isRecordOverdue(values, shape);
              const late = daysOverdue(values, shape);
              const done = values[shape.doneKey] === true;
              const remove = deleteRecord.bind(null, eventId, record.id);

              return (
                <li key={record.id} className="flex flex-wrap items-center gap-2 px-2 py-1">
                  <Cell
                    eventId={eventId}
                    recordId={record.id}
                    field={doneField}
                    value={values[shape.doneKey]}
                  />
                  <span
                    className={`min-w-[12rem] flex-1 text-[13px] ${
                      done ? "text-ink-muted line-through" : "text-ink"
                    }`}
                  >
                    {titleKey ? readText(values, titleKey) || "Untitled" : "Untitled"}
                  </span>

                  {detailFields.map((f) => (
                    <span key={f.id} className="w-36 shrink-0">
                      {f.key === shape.dueKey && overdue ? (
                        <span className="block px-2 py-1.5 font-mono text-meta tabular-nums text-danger">
                          {late} day{late === 1 ? "" : "s"} late
                        </span>
                      ) : (
                        <Cell
                          eventId={eventId}
                          recordId={record.id}
                          field={f}
                          value={values[f.key]}
                          linkOptions={optionsFor(f, linkOptions)}
                        />
                      )}
                    </span>
                  ))}

                  <form action={remove}>
                    <button
                      type="submit"
                      className="h-11 px-2 text-meta text-ink-muted hover:text-danger"
                    >
                      Delete
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
