"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { reorderEventTabs } from "@/app/(app)/events/[eventId]/tab-actions";

/**
 * Native tabs only. Files moved to the composed tier and now arrives through
 * `screens`, like anything a user builds — which is the whole point of the split.
 *
 * The consolidated tab set. Keys are unchanged from before the redesign — they're what
 * `Event.tabOrder` already stores and what the route segments are called — so this is a
 * relabelling, not a data or routing change.
 *
 * Tasks is deliberately absent: tasks belong to run-of-show blocks and render nested
 * under them. The filtered all-tasks view hangs off the Run of show header instead.
 */
const BUILT_IN_TABS = [
  { key: "schedule", label: "Run of show" },
  { key: "budget", label: "Budget" },
  { key: "registrants", label: "Registration" },
  { key: "team", label: "People" },
] as const;

export type ScreenTab = { id: string; name: string; icon: string | null };

type Tab = { key: string; label: string; href: string };

function tabClasses(active: boolean, extra = "") {
  return `flex h-11 items-center border-b-2 px-1 text-ui transition-colors ${
    active
      ? "border-ink text-ink"
      : "border-transparent text-ink-muted hover:text-ink"
  } ${extra}`;
}

function SortableTab({ tab, active }: { tab: Tab; active: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.key,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <Link
      ref={setNodeRef}
      style={style}
      href={tab.href}
      aria-current={active ? "page" : undefined}
      {...attributes}
      {...listeners}
      className={tabClasses(active, `cursor-grab ${isDragging ? "opacity-40" : ""}`)}
    >
      {tab.label}
    </Link>
  );
}

/**
 * Orders `tabs` by the saved key list, appending anything the saved order doesn't mention
 * and dropping keys that no longer resolve to a tab (such as the retired "tasks" key).
 */
function applySavedOrder(tabs: Tab[], savedOrder: string[]): Tab[] {
  const byKey = new Map(tabs.map((tab) => [tab.key, tab]));
  const ordered: Tab[] = [];
  for (const key of savedOrder) {
    const tab = byKey.get(key);
    if (tab) {
      ordered.push(tab);
      byKey.delete(key);
    }
  }
  return [...ordered, ...Array.from(byKey.values())];
}

export function EventTabs({
  eventId,
  screens,
  tabOrder,
}: {
  eventId: string;
  screens: ScreenTab[];
  tabOrder: string[];
}) {
  const pathname = usePathname();

  function buildTabs(): Tab[] {
    const all: Tab[] = [
      ...BUILT_IN_TABS.map((tab) => ({
        key: tab.key,
        label: tab.label,
        href: `/events/${eventId}/${tab.key}`,
      })),
      ...screens.map((screen) => ({
        key: `screen:${screen.id}`,
        label: screen.name,
        href: `/events/${eventId}/screens/${screen.id}`,
      })),
    ];
    return applySavedOrder(all, tabOrder);
  }

  const [tabs, setTabs] = useState<Tab[]>(buildTabs);
  // Re-sync when the server sends a different tab set (screen added/removed/renamed).
  useEffect(() => {
    setTabs(buildTabs());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, JSON.stringify(screens), JSON.stringify(tabOrder)]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setTabs((prev) => {
      const oldIndex = prev.findIndex((t) => t.key === active.id);
      const newIndex = prev.findIndex((t) => t.key === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const next = arrayMove(prev, oldIndex, newIndex);
      reorderEventTabs(
        eventId,
        next.map((t) => t.key),
      );
      return next;
    });
  }

  return (
    <div className="flex items-center justify-between gap-6 border-b border-rule">
      <nav aria-label="Event sections">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={tabs.map((t) => t.key)} strategy={horizontalListSortingStrategy}>
            <ul className="-mb-px flex items-center gap-6">
              {tabs.map((tab) => (
                <li key={tab.key}>
                  <SortableTab tab={tab} active={pathname?.startsWith(tab.href) ?? false} />
                </li>
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </nav>

      {/* An action, not a section — so it sits outside the tab list as a plain text button. */}
      <Link
        href={`/builder/new?eventId=${eventId}`}
        className="flex h-11 shrink-0 items-center text-ui text-ink-muted transition-colors hover:text-ink"
      >
        + New screen
      </Link>
    </div>
  );
}
