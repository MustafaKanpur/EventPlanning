"use client";

import { useEffect, useState, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { FieldDefinition, Prisma, ScreenRecord } from "@prisma/client";

import type { SelectOption } from "@/lib/screen-templates";
import { OPTION_COLOR_CLASSES } from "@/lib/screen-templates";
import { readText, valuesOf } from "@/lib/records";
import { setRecordGroup } from "@/app/(app)/events/[eventId]/screens/actions";

type Props = {
  eventId: string;
  records: ScreenRecord[];
  groupField: FieldDefinition;
  choices: SelectOption[];
  /** First three fields, per the spec — enough to identify a card, not a form. */
  cardFields: FieldDefinition[];
};

/**
 * Columns from a SELECT field's options, plus an "Unset" column for records that have
 * no value yet — without it, a record can be dragged out of the board and never back.
 */
export function BoardView({ eventId, records, groupField, choices, cardFields }: Props) {
  const [items, setItems] = useState(records);
  useEffect(() => setItems(records), [records]);

  const [, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const columns: { value: string | null; label: string; color: string }[] = [
    ...choices.map((c) => ({ value: c.value, label: c.label, color: c.color })),
    { value: null, label: "Unset", color: "gray" },
  ];

  const recordsFor = (value: string | null) =>
    items.filter((record) => {
      const current = valuesOf(record)[groupField.key];
      return (current ?? null) === value;
    });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const recordId = String(active.id);
    const target = over.data.current?.value as string | null | undefined;
    if (target === undefined) return;

    // Optimistic: the column moves under the cursor, the server write follows.
    setItems((prev) =>
      prev.map((record) =>
        record.id === recordId
          ? {
              ...record,
              values: {
                ...valuesOf(record),
                [groupField.key]: target,
              } as Prisma.JsonValue,
            }
          : record,
      ),
    );
    startTransition(() => {
      setRecordGroup(eventId, recordId, groupField.key, target);
    });
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {columns.map((column) => (
          <Column
            key={column.value ?? "__unset"}
            column={column}
            records={recordsFor(column.value)}
            cardFields={cardFields}
          />
        ))}
      </div>
    </DndContext>
  );
}

// Kept as its own component on purpose: co-locating useDroppable with a parent's state
// is what broke drop registration in the screen builder.
function Column({
  column,
  records,
  cardFields,
}: {
  column: { value: string | null; label: string; color: string };
  records: ScreenRecord[];
  cardFields: FieldDefinition[];
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `col-${column.value ?? "__unset"}`,
    data: { value: column.value },
  });

  return (
    <div
      ref={setNodeRef}
      className={`w-64 shrink-0 border p-2 ${
        isOver ? "border-accent bg-panel-alt" : "border-rule bg-panel"
      }`}
    >
      <div className="mb-2 flex items-center gap-2 px-1">
        <span
          className={`px-2 py-0.5 text-micro uppercase ${
            OPTION_COLOR_CLASSES[column.color] ?? "bg-panel-alt text-ink-muted"
          }`}
        >
          {column.label}
        </span>
        <span className="font-mono text-meta tabular-nums text-ink-muted">{records.length}</span>
      </div>
      <div className="space-y-2">
        {records.length === 0 ? (
          <p className="px-1 py-2 text-meta text-ink-muted">Nothing here.</p>
        ) : (
          records.map((record) => <Card key={record.id} record={record} fields={cardFields} />)
        )}
      </div>
    </div>
  );
}

function Card({ record, fields }: { record: ScreenRecord; fields: FieldDefinition[] }) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: record.id,
  });
  const values = valuesOf(record);
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const shown = fields
    .map((f) => ({ field: f, text: readText(values, f.key) }))
    .filter((v) => v.text !== "");

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-grab border border-rule bg-panel p-2 ${isDragging ? "opacity-40" : ""}`}
    >
      {shown.length === 0 ? (
        <p className="text-[13px] text-ink-muted">Untitled</p>
      ) : (
        shown.map(({ field, text }, i) => (
          <p
            key={field.id}
            className={`truncate ${
              i === 0 ? "text-[13px] text-ink" : "text-meta text-ink-muted"
            }`}
          >
            {text}
          </p>
        ))
      )}
    </div>
  );
}
