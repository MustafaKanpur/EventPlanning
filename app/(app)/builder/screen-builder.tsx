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
import { createScreen, updateScreen } from "./actions";
import type { BuilderField, BuilderScreenInput } from "./types";

function slugify(label: string) {
  const base = label.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  return base || `opt-${Math.random().toString(36).slice(2, 7)}`;
}

function PaletteItem({ type }: { type: FieldType }) {
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
      className={`w-full cursor-grab rounded-[3px] border border-rule bg-panel px-3 py-2 text-left text-sm text-ink transition hover:border-rule hover:bg-panel-alt ${
        isDragging ? "opacity-40" : ""
      }`}
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
                  title={color}
                  className={`flex h-5 w-5 items-center justify-center rounded-full border border-rule text-[10px] font-bold text-panel transition ${
                    OPTION_SWATCH_CLASSES[color]
                  } ${
                    selected
                      ? "ring-2 ring-ink ring-offset-2"
                      : "opacity-70 hover:opacity-100"
                  }`}
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
            className="flex-1 rounded-[3px] border border-rule px-2 py-1 text-xs focus:border-accent focus:outline-none "
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
  field,
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
    id: field.key,
  });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const meta = FIELD_TYPE_META[field.type];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-[3px] border border-rule bg-panel p-3 ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab text-ink-muted hover:text-ink-muted"
          aria-label="Drag to reorder"
        >
          ⠿
        </button>
        <select
          value={field.type}
          onChange={(e) => {
            const nextType = e.target.value as FieldType;
            onChange({
              ...field,
              type: nextType,
              options:
                nextType === "SELECT"
                  ? field.options && field.options.length > 0
                    ? field.options
                    : [{ value: "option-1", label: "Option 1", color: "gray" }]
                  : field.options,
            });
          }}
          className="shrink-0 rounded-full border-none bg-panel-alt px-2 py-0.5 text-xs font-medium text-ink-muted focus:outline-none"
        >
          {FIELD_GROUPS.flatMap((g) => g.types).map((type) => (
            <option key={type} value={type}>
              {FIELD_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        <input
          value={field.label}
          onChange={(e) => onChange({ ...field, label: e.target.value })}
          placeholder="Field label"
          maxLength={80}
          className="flex-1 rounded-[3px] border border-rule px-2 py-1 text-sm focus:border-accent focus:outline-none "
        />
        <label className="flex shrink-0 items-center gap-1 text-xs text-ink-muted">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => onChange({ ...field, required: e.target.checked })}
          />
          Required
        </label>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 text-sm text-ink-muted hover:text-danger"
        >
          Remove
        </button>
      </div>

      {/* Show whoever is building the screen exactly what this field will ask for. */}
      {(meta.placeholder || meta.maxLength) && (
        <p className="mt-1 pl-7 text-xs text-ink-muted">
          {meta.placeholder && <span>Example: {meta.placeholder}</span>}
          {meta.placeholder && meta.maxLength ? " · " : ""}
          {meta.maxLength && <span>up to {meta.maxLength} characters</span>}
          {field.type === "URL" && <span> · collects display text + URL</span>}
        </p>
      )}

      {/* Rollups: the opt-in that makes a screen participate in the system rather than
          sit beside it. Only currency and date fields have anywhere to post to. */}
      {field.type === "CURRENCY" && (
        <div className="mt-2 flex items-center gap-2 border-t border-rule-soft pl-7 pt-2">
          <label className="text-xs text-ink-muted" htmlFor={`rollup-${field.key}`}>
            Post total to
          </label>
          <select
            id={`rollup-${field.key}`}
            value={field.rollupTarget ?? ""}
            onChange={(e) => onChange({ ...field, rollupTarget: e.target.value || null })}
            className="rounded-[3px] border border-rule px-2 py-1 text-xs focus:border-accent focus:outline-none"
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

      {(field.type === "DATE" || field.type === "DATETIME") && (
        <label className="mt-2 flex items-center gap-2 border-t border-rule-soft pl-7 pt-2 text-xs text-ink-muted">
          <input
            type="checkbox"
            checked={field.rollupTarget === "RUN_OF_SHOW"}
            onChange={(e) =>
              onChange({ ...field, rollupTarget: e.target.checked ? "RUN_OF_SHOW" : null })
            }
          />
          Show these records on the run of show
        </label>
      )}

      {/* A link is only meaningful once it knows what it points at. */}
      {(field.type === "LINK" || field.type === "PERSON") && (
        <div className="mt-2 flex items-center gap-2 border-t border-rule-soft pl-7 pt-2">
          <label className="text-xs text-ink-muted" htmlFor={`target-${field.key}`}>
            Points at
          </label>
          <select
            id={`target-${field.key}`}
            value={field.targetType ?? (field.type === "PERSON" ? "TEAM_MEMBER" : "SCHEDULE_ITEM")}
            onChange={(e) => onChange({ ...field, targetType: e.target.value as LinkTarget })}
            className="rounded-[3px] border border-rule px-2 py-1 text-xs focus:border-accent focus:outline-none"
          >
            {(Object.keys(LINK_TARGET_LABELS) as LinkTarget[]).map((target) => (
              <option key={target} value={target}>
                {LINK_TARGET_LABELS[target]}
              </option>
            ))}
          </select>
        </div>
      )}

      {field.type === "SELECT" && (
        <SelectOptionsEditor
          options={field.options ?? []}
          onChange={(options) => onChange({ ...field, options })}
        />
      )}
    </div>
  );
}

// dnd-kit's droppable registration is unreliable when `useDroppable` is called in a
// component that also owns a lot of unrelated, frequently-changing state (name/icon/view
// inputs, etc.) — its measured rect stays null and drops never resolve a target. Keeping
// it isolated in its own small component (like PaletteItem/FieldRow already are) fixes it.
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
      className={`min-h-[10rem] space-y-2 rounded-[3px] border-2 border-dashed p-3 transition ${
        isOver ? "border-accent bg-panel-alt" : "border-rule"
      }`}
    >
      {fields.length === 0 ? (
        <p className="p-6 text-center text-sm text-ink-muted">
          Drop field types here to build the screen.
        </p>
      ) : (
        <SortableContext items={fields.map((f) => f.key)} strategy={verticalListSortingStrategy}>
          {fields.map((field) => (
            <FieldRow
              key={field.key}
              field={field}
              onChange={(next) => onUpdateField(field.key, next)}
              onRemove={() => onRemoveField(field.key)}
              budgetLines={budgetLines}
            />
          ))}
        </SortableContext>
      )}
    </div>
  );
}

export type ScreenBuilderProps = {
  /** Screens belong to an event now — the library concept is gone. */
  eventId: string;
  /** Present when editing an existing definition. */
  definitionId?: string;
  initialName?: string;
  initialIcon?: string;
  initialViewType?: ViewType;
  initialGroupByFieldKey?: string | null;
  /** Rollup destinations for CURRENCY fields. */
  budgetLines?: { id: string; category: string }[];
  initialFields?: BuilderField[];
  /** Rendered beneath the actions — a delete control, when there's something to delete. */
  discardSlot?: React.ReactNode;
};

export function ScreenBuilder({
  eventId,
  definitionId,
  initialName = "",
  initialIcon = "",
  initialViewType = "TABLE",
  initialGroupByFieldKey = null,
  budgetLines = [],
  initialFields,
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
      targetType:
        type === "PERSON" ? "TEAM_MEMBER" : type === "LINK" ? "SCHEDULE_ITEM" : undefined,
      options: type === "SELECT" ? [{ value: "option-1", label: "Option 1", color: "gray" }] : undefined,
      required: false,
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
  }

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    if (typeof active.id === "string" && active.id.startsWith("palette-")) {
      const type = active.data.current?.fieldType as FieldType;
      setActiveDragLabel(FIELD_TYPE_LABELS[type]);
    } else {
      const field = fields.find((f) => f.key === active.id);
      setActiveDragLabel(field ? field.label || FIELD_TYPE_LABELS[field.type] : null);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragLabel(null);
    const { active, over } = event;
    if (!over) return;

    const isPaletteDrag = typeof active.id === "string" && active.id.startsWith("palette-");

    if (isPaletteDrag) {
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

  // Prefer whatever droppable the pointer is literally inside (most intuitive for a
  // small dragged chip over a large dropzone); fall back to rect overlap, then nearest
  // center, so a drop never silently fails to resolve a target.
  const collisionDetection: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    const rectCollisions = rectIntersection(args);
    if (rectCollisions.length > 0) return rectCollisions;
    return closestCenter(args);
  };

  function submit() {
    setError(null);
    if (!name.trim()) {
      setError("Give the screen a name.");
      return;
    }
    if (fields.length === 0) {
      setError("Add at least one field.");
      return;
    }

    const input: BuilderScreenInput = {
      eventId,
      name,
      icon: icon || null,
      viewType,
      groupByFieldKey,
      fields,
    };

    startTransition(async () => {
      const result = definitionId ? await updateScreen(definitionId, input) : await createScreen(input);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-[3px] border border-rule bg-panel p-4 ">
        <div className="space-y-1">
          <label className="text-xs font-medium text-ink-muted">Icon (optional)</label>
          <input
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="📋"
            maxLength={2}
            className="w-16 rounded-[3px] border border-rule px-2 py-2 text-center text-sm focus:border-accent focus:outline-none "
          />
        </div>
        <div className="min-w-[12rem] flex-1 space-y-1">
          <label className="text-xs font-medium text-ink-muted">Screen name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Permit Tracking"
            maxLength={80}
            className="w-full rounded-[3px] border border-rule px-3 py-2 text-sm focus:border-accent focus:outline-none "
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-ink-muted" htmlFor="view-type">
            View type
          </label>
          <select
            id="view-type"
            value={viewType}
            onChange={(e) => setViewType(e.target.value as ViewType)}
            className="rounded-[3px] border border-rule px-3 py-2 text-sm focus:border-accent focus:outline-none"
          >
            <option value="TABLE">Table</option>
            <option value="BOARD">Board</option>
            <option value="TIMELINE">Timeline</option>
            <option value="CHECKLIST">Checklist</option>
            <option value="CALENDAR">Calendar</option>
            <option value="LEDGER">Ledger</option>
          </select>
        </div>

        {viewType === "BOARD" && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-ink-muted" htmlFor="group-by">
              Group columns by
            </label>
            <select
              id="group-by"
              value={groupByFieldKey ?? ""}
              onChange={(e) => setGroupByFieldKey(e.target.value || null)}
              className="rounded-[3px] border border-rule px-3 py-2 text-sm focus:border-accent focus:outline-none"
            >
              <option value="">First Select field</option>
              {fields
                .filter((f) => f.type === "SELECT")
                .map((f) => (
                  <option key={f.key} value={f.id ?? f.key}>
                    {f.label}
                  </option>
                ))}
            </select>
          </div>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase text-ink-muted">Drag a field type onto the screen →</p>
            {FIELD_GROUPS.map((group) => (
              <div key={group.label} className="space-y-2">
                <p className="text-micro uppercase text-ink-muted">{group.label}</p>
                {group.types.map((type) => (
                  <PaletteItem key={type} type={type} />
                ))}
              </div>
            ))}
          </div>

          <Canvas
            fields={fields}
            onUpdateField={updateField}
            onRemoveField={removeField}
            budgetLines={budgetLines}
          />
        </div>

        <DragOverlay>
          {activeDragLabel && (
            <div className="rounded-[3px] border border-accent bg-panel px-3 py-2 text-sm ">
              {activeDragLabel}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {error && <p className="rounded-[3px] bg-panel-alt px-4 py-2 text-sm text-danger">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => submit()}
          disabled={isPending}
          className="rounded-[3px] bg-accent px-4 py-2 text-sm font-medium text-panel transition hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Saving…" : definitionId ? "Save screen" : "Create screen"}
        </button>
        {discardSlot}
      </div>
    </div>
  );
}
