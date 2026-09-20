"use client";

import { useState, useTransition } from "react";
import type { FieldType, LinkTarget, ViewType } from "@prisma/client";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  FIELD_GROUPS,
  FIELD_TYPE_LABELS,
  FIELD_TYPE_META,
  OPTION_COLORS,
  OPTION_SWATCH_CLASSES,
  type SelectOption,
} from "@/lib/screen-templates";
import { LINK_TARGET_LABELS } from "@/lib/link-targets";
import { ViewPreview } from "@/components/screens/view-preview";
import { createScreen, updateScreen } from "./actions";
import type { BuilderField, BuilderScreenInput } from "./types";

const field =
  "w-full border border-rule bg-panel px-3 py-2 text-[13px] text-ink focus:border-accent focus:outline-none";
const small =
  "border border-rule bg-panel px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none";

/** View type comes first because it constrains which fields make sense. */
const VIEW_TYPES: { value: ViewType; label: string; blurb: string }[] = [
  { value: "TABLE", label: "Table", blurb: "Ruled rows. The default." },
  { value: "BOARD", label: "Board", blurb: "Columns grouped by a Select field." },
  { value: "TIMELINE", label: "Timeline", blurb: "Placed on the event-day time gutter." },
  { value: "CHECKLIST", label: "Checklist", blurb: "Completion ratio and overdue items." },
  { value: "CALENDAR", label: "Calendar", blurb: "A month grid." },
  { value: "LEDGER", label: "Ledger", blurb: "Money columns, totalled." },
];

function slugify(label: string) {
  const base = label.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  return base || `opt-${Math.random().toString(36).slice(2, 7)}`;
}

function PaletteItem({ type, primary }: { type: FieldType; primary: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: { source: "palette", fieldType: type },
  });

  return (
    <button
      type="button"
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`w-full cursor-grab border px-3 py-2 text-left text-[13px] transition-colors ${
        primary
          ? "border-accent/40 bg-accent/[0.06] text-ink hover:bg-accent/10"
          : "border-rule bg-panel text-ink hover:bg-panel-alt"
      } ${isDragging ? "opacity-40" : ""}`}
    >
      {FIELD_TYPE_LABELS[type]}
    </button>
  );
}

function SelectOptionsEditor({
  options,
  onChange,
}: {
  options: SelectOption[];
  onChange: (options: SelectOption[]) => void;
}) {
  return (
    <div className="mt-2 space-y-1 border-t border-rule-soft pl-7 pt-2">
      {options.map((option, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex gap-1.5">
            {OPTION_COLORS.map((color) => {
              const selected = option.color === color;
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    const next = [...options];
                    next[i] = { ...option, color };
                    onChange(next);
                  }}
                  aria-label={color}
                  aria-pressed={selected}
                  className={`flex h-5 w-5 items-center justify-center rounded-full border border-rule text-[10px] font-bold text-panel transition ${
                    OPTION_SWATCH_CLASSES[color]
                  } ${selected ? "ring-2 ring-ink ring-offset-2" : "opacity-70 hover:opacity-100"}`}
                >
                  {selected ? "✓" : ""}
                </button>
              );
            })}
          </div>
          <input
            value={option.label}
            onChange={(e) => {
              const label = e.target.value;
              const next = [...options];
              next[i] = { ...option, label, value: slugify(label) };
              onChange(next);
            }}
            placeholder="Option label"
            maxLength={60}
            className={`${small} flex-1`}
          />
          <button
            type="button"
            onClick={() => onChange(options.filter((_, idx) => idx !== i))}
            className="text-xs text-ink-muted hover:text-danger"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange([
            ...options,
            {
              value: slugify(`Option ${options.length + 1}`),
              label: `Option ${options.length + 1}`,
              color: OPTION_COLORS[options.length % OPTION_COLORS.length],
            },
          ])
        }
        className="text-xs font-medium text-accent hover:text-ink"
      >
        + Add option
      </button>
    </div>
  );
}

function FieldRow({
  field: def,
  onChange,
  onRemove,
  budgetLines,
}: {
  field: BuilderField;
  onChange: (next: BuilderField) => void;
  onRemove: () => void;
  budgetLines: { id: string; category: string }[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: def.key,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const meta = FIELD_TYPE_META[def.type];
  const isConnection = def.type === "LINK" || def.type === "PERSON";
  const isDate = def.type === "DATE" || def.type === "DATETIME";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border bg-panel p-3 ${isConnection ? "border-accent/40" : "border-rule"} ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab text-ink-muted hover:text-ink"
          aria-label={`Reorder ${def.label || "field"}`}
        >
          ⠿
        </button>
        <select
          value={def.type}
          onChange={(e) => {
            const nextType = e.target.value as FieldType;
            onChange({
              ...def,
              type: nextType,
              options:
                nextType === "SELECT" || nextType === "MULTI_SELECT"
                  ? def.options?.length
                    ? def.options
                    : [{ value: "option-1", label: "Option 1", color: "gray" }]
                  : def.options,
              targetType:
                nextType === "PERSON"
                  ? "TEAM_MEMBER"
                  : nextType === "LINK"
                    ? (def.targetType ?? "SCHEDULE_ITEM")
                    : undefined,
              rollupTarget:
                nextType === "CURRENCY" || nextType === "DATE" || nextType === "DATETIME"
                  ? def.rollupTarget
                  : null,
            });
          }}
          aria-label="Field type"
          className="shrink-0 border-none bg-panel-alt px-2 py-0.5 text-xs font-medium text-ink-muted focus:outline-none"
        >
          {FIELD_GROUPS.flatMap((g) => g.types).map((type) => (
            <option key={type} value={type}>
              {FIELD_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        <input
          value={def.label}
          onChange={(e) => onChange({ ...def, label: e.target.value })}
          placeholder="Field label"
          maxLength={80}
          aria-label="Field label"
          className={`${small} flex-1`}
        />
        <label className="flex shrink-0 items-center gap-1 text-xs text-ink-muted">
          <input
            type="checkbox"
            checked={def.required}
            onChange={(e) => onChange({ ...def, required: e.target.checked })}
          />
          Required
        </label>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 text-xs text-ink-muted hover:text-danger"
        >
          Remove
        </button>
      </div>

      {(meta.placeholder || meta.maxLength) && (
        <p className="mt-1 pl-7 text-xs text-ink-muted">
          {meta.placeholder && <span>Example: {meta.placeholder}</span>}
          {meta.placeholder && meta.maxLength ? " · " : ""}
          {meta.maxLength && <span>up to {meta.maxLength} characters</span>}
        </p>
      )}

      {isConnection && (
        <div className="mt-2 flex items-center gap-2 border-t border-rule-soft pl-7 pt-2">
          <label className="text-xs text-ink-muted" htmlFor={`target-${def.key}`}>
            Points at
          </label>
          <select
            id={`target-${def.key}`}
            value={def.targetType ?? "SCHEDULE_ITEM"}
            onChange={(e) => onChange({ ...def, targetType: e.target.value as LinkTarget })}
            className={small}
          >
            {(Object.keys(LINK_TARGET_LABELS) as LinkTarget[]).map((target) => (
              <option key={target} value={target}>
                {LINK_TARGET_LABELS[target]}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Step 3 of the flow: where this column's value goes beyond its own screen. */}
      {def.type === "CURRENCY" && (
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-rule-soft pl-7 pt-2">
          <label className="text-xs text-ink-muted" htmlFor={`rollup-${def.key}`}>
            Post total to
          </label>
          <select
            id={`rollup-${def.key}`}
            value={def.rollupTarget ?? ""}
            onChange={(e) => onChange({ ...def, rollupTarget: e.target.value || null })}
            className={small}
          >
            <option value="">Nowhere</option>
            {budgetLines.map((line) => (
              <option key={line.id} value={line.id}>
                Budget · {line.category}
              </option>
            ))}
          </select>
          {budgetLines.length === 0 && (
            <span className="text-xs text-ink-muted">Add a budget category first</span>
          )}
        </div>
      )}

      {isDate && (
        <label className="mt-2 flex items-center gap-2 border-t border-rule-soft pl-7 pt-2 text-xs text-ink-muted">
          <input
            type="checkbox"
            checked={def.rollupTarget === "RUN_OF_SHOW"}
            onChange={(e) =>
              onChange({ ...def, rollupTarget: e.target.checked ? "RUN_OF_SHOW" : null })
            }
          />
          Show these records on the run of show
        </label>
      )}

      {(def.type === "SELECT" || def.type === "MULTI_SELECT") && (
        <SelectOptionsEditor
          options={def.options ?? []}
          onChange={(options) => onChange({ ...def, options })}
        />
      )}
    </div>
  );
}

// dnd-kit's droppable registration is unreliable when `useDroppable` is called in a
// component that also owns a lot of unrelated, frequently-changing state — its measured
// rect stays null and drops never resolve a target. Keeping it isolated in its own small
// component is what fixed that, so do not fold this back into the parent.
function Canvas({
  fields,
  onUpdateField,
  onRemoveField,
  budgetLines,
}: {
  fields: BuilderField[];
  onUpdateField: (key: string, next: BuilderField) => void;
  onRemoveField: (key: string) => void;
  budgetLines: { id: string; category: string }[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas" });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[12rem] space-y-2 border-2 border-dashed p-3 transition ${
        isOver ? "border-accent bg-panel-alt" : "border-rule"
      }`}
    >
      {fields.length === 0 ? (
        <p className="p-6 text-center text-[13px] text-ink-muted">
          Drag a field across, starting with what this screen is called by — usually a Text
          field.
        </p>
      ) : (
        <SortableContext items={fields.map((f) => f.key)} strategy={verticalListSortingStrategy}>
          {fields.map((f) => (
            <FieldRow
              key={f.key}
              field={f}
              onChange={(next) => onUpdateField(f.key, next)}
              onRemove={() => onRemoveField(f.key)}
              budgetLines={budgetLines}
            />
          ))}
        </SortableContext>
      )}
    </div>
  );
}

export type ScreenBuilderProps = {
  eventId: string;
  definitionId?: string;
  initialName?: string;
  initialIcon?: string;
  initialViewType?: ViewType;
  initialGroupByFieldKey?: string | null;
  initialFields?: BuilderField[];
  budgetLines?: { id: string; category: string }[];
  discardSlot?: React.ReactNode;
};

export function ScreenBuilder({
  eventId,
  definitionId,
  initialName = "",
  initialIcon = "",
  initialViewType = "TABLE",
  initialGroupByFieldKey = null,
  initialFields,
  budgetLines = [],
  discardSlot,
}: ScreenBuilderProps) {
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState(initialIcon);
  const [viewType, setViewType] = useState<ViewType>(initialViewType);
  const [groupByFieldKey, setGroupByFieldKey] = useState<string | null>(initialGroupByFieldKey);
  const [fields, setFields] = useState<BuilderField[]>(initialFields ?? []);
  const [activeDragLabel, setActiveDragLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function addField(type: FieldType, atIndex: number) {
    const newField: BuilderField = {
      key: crypto.randomUUID(),
      label: FIELD_TYPE_LABELS[type],
      type,
      options:
        type === "SELECT" || type === "MULTI_SELECT"
          ? [{ value: "option-1", label: "Option 1", color: "gray" }]
          : undefined,
      required: false,
      targetType:
        type === "PERSON" ? "TEAM_MEMBER" : type === "LINK" ? "SCHEDULE_ITEM" : undefined,
      rollupTarget: null,
    };
    setFields((prev) => {
      const next = [...prev];
      next.splice(atIndex, 0, newField);
      return next;
    });
  }

  function updateField(key: string, next: BuilderField) {
    setFields((prev) => prev.map((f) => (f.key === key ? next : f)));
  }

  function removeField(key: string) {
    setFields((prev) => prev.filter((f) => f.key !== key));
    if (groupByFieldKey === key) setGroupByFieldKey(null);
  }

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    if (typeof active.id === "string" && active.id.startsWith("palette-")) {
      setActiveDragLabel(FIELD_TYPE_LABELS[active.data.current?.fieldType as FieldType]);
    } else {
      const found = fields.find((f) => f.key === active.id);
      setActiveDragLabel(found ? found.label || FIELD_TYPE_LABELS[found.type] : null);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragLabel(null);
    const { active, over } = event;
    if (!over) return;

    if (typeof active.id === "string" && active.id.startsWith("palette-")) {
      const type = active.data.current?.fieldType as FieldType;
      const overIndex = over.id === "canvas" ? fields.length : fields.findIndex((f) => f.key === over.id);
      addField(type, overIndex === -1 ? fields.length : overIndex);
      return;
    }

    if (active.id !== over.id) {
      setFields((prev) => {
        const oldIndex = prev.findIndex((f) => f.key === active.id);
        const newIndex = prev.findIndex((f) => f.key === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }

  const collisionDetection: CollisionDetection = (args) => {
    const pointer = pointerWithin(args);
    if (pointer.length) return pointer;
    const rect = rectIntersection(args);
    return rect.length ? rect : closestCenter(args);
  };

  function submit(asDraft: boolean) {
    setError(null);
    if (!name.trim()) {
      setError("Give the screen a name.");
      return;
    }
    if (!asDraft && fields.length === 0) {
      setError("Add at least one field, or save it as a draft for now.");
      return;
    }

    const input: BuilderScreenInput = {
      eventId,
      name,
      icon: icon || null,
      viewType,
      groupByFieldKey,
      isDraft: asDraft,
      fields,
    };

    startTransition(async () => {
      const result = definitionId ? await updateScreen(definitionId, input) : await createScreen(input);
      if (result?.error) setError(result.error);
    });
  }

  const selectFields = fields.filter((f) => f.type === "SELECT");

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-8">
          {/* ── 1 · what it is ───────────────────────────────────────────── */}
          <section>
            <h2 className="text-micro uppercase text-ink-muted">1 · Screen</h2>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="block text-caption text-ink-muted" htmlFor="screen-icon">
                  Icon
                </label>
                <input
                  id="screen-icon"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  placeholder="◆"
                  maxLength={2}
                  className={`${field} w-16 text-center`}
                />
              </div>
              <div className="min-w-[14rem] flex-1 space-y-1">
                <label className="block text-caption text-ink-muted" htmlFor="screen-name">
                  Screen name
                </label>
                <input
                  id="screen-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Vendor Stalls"
                  maxLength={80}
                  className={field}
                />
              </div>
            </div>

            <p className="mt-4 text-caption text-ink-muted">
              How should these records be shown? This is the bigger decision — it decides
              which fields are worth having.
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {VIEW_TYPES.map((option) => {
                const active = viewType === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setViewType(option.value)}
                    aria-pressed={active}
                    className={`border p-3 text-left transition-colors ${
                      active
                        ? "border-ink bg-panel-alt"
                        : "border-rule bg-panel hover:bg-panel-alt"
                    }`}
                  >
                    <span className="block text-[13px] text-ink">{option.label}</span>
                    <span className="mt-0.5 block text-meta text-ink-muted">{option.blurb}</span>
                  </button>
                );
              })}
            </div>

            {viewType === "BOARD" && (
              <div className="mt-3 flex items-center gap-2">
                <label className="text-caption text-ink-muted" htmlFor="group-by">
                  Group columns by
                </label>
                <select
                  id="group-by"
                  value={groupByFieldKey ?? ""}
                  onChange={(e) => setGroupByFieldKey(e.target.value || null)}
                  className={small}
                >
                  <option value="">First Select field</option>
                  {selectFields.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </section>

          {/* ── 2 · fields ───────────────────────────────────────────────── */}
          <section>
            <h2 className="text-micro uppercase text-ink-muted">2 · Fields</h2>
            <div className="mt-2 grid gap-4 sm:grid-cols-[13rem_1fr]">
              <div className="space-y-4">
                {/* Connections first and tinted: linking to the rest of the event is what
                    separates this from a spreadsheet, so it should not be buried. */}
                {[...FIELD_GROUPS].reverse().map((group) => {
                  const primary = group.label === "Connections";
                  return (
                    <div key={group.label} className="space-y-2">
                      <p
                        className={`text-micro uppercase ${
                          primary ? "text-accent" : "text-ink-muted"
                        }`}
                      >
                        {group.label}
                      </p>
                      {primary && (
                        <p className="text-meta text-ink-muted">
                          Points at vendors, blocks, budget lines and people.
                        </p>
                      )}
                      {group.types.map((type) => (
                        <PaletteItem key={type} type={type} primary={primary} />
                      ))}
                    </div>
                  );
                })}
              </div>

              <Canvas
                fields={fields}
                onUpdateField={updateField}
                onRemoveField={removeField}
                budgetLines={budgetLines}
              />
            </div>
          </section>

          {error && (
            <p className="border border-rule px-4 py-2 text-[13px] text-danger" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => submit(false)}
              disabled={isPending}
              className="h-11 bg-accent px-4 text-ui text-panel transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? "Saving…" : definitionId ? "Save screen" : "Create screen"}
            </button>
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={isPending}
              className="h-11 border border-rule px-4 text-ui text-ink transition-colors hover:bg-panel-alt disabled:opacity-50"
            >
              Save as draft
            </button>
            {discardSlot}
          </div>
          <p className="text-meta text-ink-muted">
            A draft is editable but stays out of the event&apos;s tabs until you save it
            properly.
          </p>
        </div>

        {/* ── live preview ───────────────────────────────────────────────── */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <h2 className="text-micro uppercase text-ink-muted">Preview</h2>
          <p className="mb-2 mt-1 text-meta text-ink-muted">
            {name.trim() || "Untitled screen"} · placeholder records
          </p>
          <ViewPreview
            viewType={viewType}
            fields={fields.map((f) => ({
              key: f.key,
              label: f.label,
              type: f.type,
              options: f.options,
            }))}
          />
        </aside>
      </div>

      <DragOverlay>
        {activeDragLabel && (
          <div className="border border-accent bg-panel px-3 py-2 text-[13px] text-ink">
            {activeDragLabel}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
