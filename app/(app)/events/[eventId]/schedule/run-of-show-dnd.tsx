"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
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

import { placeScheduleItem } from "./actions";

type SlotData = { startISO: string; maxMinutes?: number };

/**
 * Wraps both columns so an unplaced block in the rail can be dropped onto a slot in the
 * timeline. Only the context lives here; the draggable and droppable leaves are separate
 * components below — co-locating `useDroppable` with unrelated state is what silently
 * broke drag registration in the screen builder, so the pattern is kept deliberately.
 */
export function RunOfShowDnd({
  eventId,
  children,
}: {
  eventId: string;
  children: React.ReactNode;
}) {
  const [draggingLabel, setDraggingLabel] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const collisionDetection: CollisionDetection = (args) => {
    const pointer = pointerWithin(args);
    if (pointer.length) return pointer;
    const rect = rectIntersection(args);
    return rect.length ? rect : closestCenter(args);
  };

  function handleDragStart(event: DragStartEvent) {
    setDraggingLabel((event.active.data.current?.title as string) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingLabel(null);
    const { active, over } = event;
    if (!over) return;

    const itemId = active.data.current?.itemId as string | undefined;
    const slot = over.data.current as SlotData | undefined;
    if (!itemId || !slot?.startISO) return;

    startTransition(() => {
      placeScheduleItem(eventId, itemId, slot.startISO, slot.maxMinutes);
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {children}
      <DragOverlay>
        {draggingLabel && (
          <div className="border border-accent bg-panel px-3 py-2 text-ui text-ink">
            {draggingLabel}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

/** A gap in the programme, and simultaneously a place to drop an unplaced block. */
export function GapSlot({
  id,
  startISO,
  minutes,
  resumesAt,
}: {
  id: string;
  startISO: string;
  minutes: number;
  resumesAt: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { startISO, maxMinutes: minutes } });

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-4 border-b border-rule-soft px-4 py-3 ${
        isOver ? "bg-warn/20" : "bg-warn/[0.09]"
      }`}
    >
      <span className="w-[76px] shrink-0 font-mono text-meta tabular-nums text-warn">
        {minutes}m
      </span>
      <p className="text-[13px] text-ink">
        Nothing scheduled — programme resumes at{" "}
        <span className="font-mono tabular-nums">{resumesAt}</span>
      </p>
    </div>
  );
}

/** Tail slot so a block can be appended after the last one. */
export function EndSlot({ startISO, label }: { startISO: string; label: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: "slot-end", data: { startISO } });

  return (
    <div
      ref={setNodeRef}
      className={`px-4 py-3 text-[13px] ${
        isOver ? "bg-accent/10 text-ink" : "text-ink-muted"
      }`}
    >
      {label}
    </div>
  );
}

export function UnplacedBlock({
  id,
  title,
  location,
  taskCount,
  aiDrafted = false,
  aiHint = null,
}: {
  id: string;
  title: string;
  location: string | null;
  taskCount: number;
  /** Proposed by "Draft with AI" and not placed yet. */
  aiDrafted?: boolean;
  /** "Suggested 20:15 · 45m", formatted on the server so it can't differ on hydration. */
  aiHint?: string | null;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `unplaced-${id}`,
    data: { itemId: id, title },
  });

  return (
    <li>
      <button
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        type="button"
        className={`w-full cursor-grab border border-rule bg-panel px-3 py-2 text-left transition-colors hover:bg-panel-alt ${
          isDragging ? "opacity-40" : ""
        }`}
      >
        {aiDrafted && <span className="block text-micro uppercase text-accent">AI draft</span>}
        <span className="block text-[13px] text-ink">{title}</span>
        <span className="mt-0.5 block text-meta text-ink-muted">
          {[
            aiHint,
            location,
            taskCount ? `${taskCount} task${taskCount === 1 ? "" : "s"}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "No time set"}
        </span>
      </button>
    </li>
  );
}
