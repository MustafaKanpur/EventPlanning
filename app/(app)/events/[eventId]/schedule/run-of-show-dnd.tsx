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
  useDndContext,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

import { placeScheduleItem } from "./actions";

/** Where a drop lands. "after": start at the anchor. "before": end at it (top of the day). */
type SlotData = { anchorISO: string; position: "after" | "before" };

/**
 * Wraps both columns so a block (from the rail, or already on the timeline) can be
 * dropped into any slot. Only the context lives here; the draggable and droppable leaves are separate
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
    if (!itemId || !slot?.anchorISO) return;

    // ponytail: no optimistic move; the block jumps once the server revalidates.
    startTransition(() => {
      placeScheduleItem(eventId, itemId, slot.anchorISO, slot.position);
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
  startsAt,
}: {
  id: string;
  startISO: string;
  minutes: number;
  resumesAt: string;
  /** Formatted on the server: the start a block dropped here gets. */
  startsAt: string;
}) {
  const data: SlotData = { anchorISO: startISO, position: "after" };
  const { setNodeRef, isOver } = useDroppable({ id, data });

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-4 border-b border-rule-soft px-4 py-3 ${
        isOver ? "bg-accent text-panel" : "bg-warn/[0.09] text-ink"
      }`}
    >
      <span
        className={`w-[76px] shrink-0 font-mono text-meta tabular-nums ${isOver ? "text-panel" : "text-warn"}`}
      >
        {minutes}m
      </span>
      <p className="text-[13px]">
        {isOver ? (
          <>Drop to start at <span className="font-mono tabular-nums">{startsAt}</span></>
        ) : (
          <>
            Nothing scheduled — programme resumes at{" "}
            <span className="font-mono tabular-nums">{resumesAt}</span>
          </>
        )}
      </p>
    </div>
  );
}

/**
 * A slot between two rows. A hairline until something is being dragged, then a visible
 * target, and a solid accent bar with the resulting time under the pointer.
 */
export function DropZone({
  id,
  anchorISO,
  position = "after",
  label,
}: {
  id: string;
  anchorISO: string;
  position?: "after" | "before";
  /** Formatted on the server, e.g. "Starts 19:30". */
  label: string;
}) {
  const { active } = useDndContext();
  const data: SlotData = { anchorISO, position };
  const { setNodeRef, isOver } = useDroppable({ id, data });

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center px-4 transition-[height] print:hidden ${
        !active ? "h-1" : isOver ? "h-9 bg-accent" : "h-5"
      }`}
    >
      {isOver ? (
        <span className="font-mono text-meta tabular-nums text-panel">{label}</span>
      ) : active ? (
        <span className="h-px w-full border-t border-dashed border-rule" aria-hidden="true" />
      ) : null}
    </div>
  );
}

/**
 * A placed block that can be picked up again. Only the grip starts a drag, so the edit
 * forms, task checkboxes and links inside the row keep working.
 */
export function DraggableRow({
  id,
  title,
  className = "",
  children,
}: {
  id: string;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: `placed-${id}`,
    data: { itemId: id, title },
  });

  return (
    <div ref={setNodeRef} className={`relative ${isDragging ? "opacity-40" : ""} ${className}`}>
      <button
        ref={setActivatorNodeRef}
        {...listeners}
        {...attributes}
        type="button"
        aria-label={`Move ${title}`}
        className="absolute left-0 top-0 flex h-11 w-5 cursor-grab items-center justify-center text-ink-muted hover:text-ink print:hidden"
      >
        <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor" aria-hidden="true">
          <circle cx="2" cy="2" r="1.2" /><circle cx="6" cy="2" r="1.2" />
          <circle cx="2" cy="7" r="1.2" /><circle cx="6" cy="7" r="1.2" />
          <circle cx="2" cy="12" r="1.2" /><circle cx="6" cy="12" r="1.2" />
        </svg>
      </button>
      {children}
    </div>
  );
}

/** Tail slot so a block can be appended after the last one. */
export function EndSlot({ startISO, label, overLabel }: { startISO: string; label: string; overLabel: string }) {
  const data: SlotData = { anchorISO: startISO, position: "after" };
  const { setNodeRef, isOver } = useDroppable({ id: "slot-end", data });

  return (
    <div
      ref={setNodeRef}
      className={`px-4 py-3 text-[13px] ${isOver ? "bg-accent text-panel" : "text-ink-muted"}`}
    >
      {isOver ? overLabel : label}
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
  editor,
}: {
  id: string;
  title: string;
  location: string | null;
  taskCount: number;
  /** Proposed by "Draft with AI" and not placed yet. */
  aiDrafted?: boolean;
  /** "Suggested 20:15 · 45m", formatted on the server so it can't differ on hydration. */
  aiHint?: string | null;
  /** Server-rendered edit panel, shown under the draggable card. */
  editor?: React.ReactNode;
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
      {editor}
    </li>
  );
}
