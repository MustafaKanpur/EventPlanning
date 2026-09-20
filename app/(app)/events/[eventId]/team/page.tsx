import { prisma } from "@/lib/prisma";
import { getChecklistScreens, valuesOf } from "@/lib/records";
import { displayName } from "@/lib/format";
import { StatusDot } from "@/components/ui";
import { addEventMember, removeEventMember, updateEventMemberRole } from "./actions";

const field =
  "h-11 border border-rule bg-panel px-3 text-[13px] text-ink focus:border-accent focus:outline-none";

/** "4 tasks · 2 run-of-show blocks" — what this person is actually carrying. */
function ownership(taskCount: number, blockCount: number): string {
  const parts: string[] = [];
  if (taskCount) parts.push(`${taskCount} task${taskCount === 1 ? "" : "s"}`);
  if (blockCount) parts.push(`${blockCount} run-of-show block${blockCount === 1 ? "" : "s"}`);
  return parts.length ? parts.join(" · ") : "Nothing assigned yet";
}

export default async function PeoplePage({ params }: { params: { eventId: string } }) {
  const { eventId } = params;

  const [event, allTeamMembers, checklists] = await Promise.all([
    prisma.event.findUnique({
      where: { id: eventId },
      include: {
        owner: true,
        members: { include: { teamMember: true }, orderBy: { teamMember: { name: "asc" } } },
      },
    }),
    prisma.teamMember.findMany({ orderBy: { name: "asc" } }),
    getChecklistScreens(eventId),
  ]);

  if (!event) return null;

  // Ownership is counted from checklist records across every checklist on the event,
  // and from the blocks those records link to — the same RecordLink data the run of
  // show reads, so the two can't disagree about who owns what.
  const taskCounts = new Map<string, number>();
  const blocksByPerson = new Map<string, Set<string>>();

  for (const screen of checklists) {
    const ownerField = screen.fields.find((f) => f.type === "PERSON");
    if (!ownerField) continue;
    const records = await prisma.screenRecord.findMany({
      where: { screenId: screen.id },
      include: { links: { select: { targetType: true, targetId: true } } },
    });
    for (const record of records) {
      const ownerId = valuesOf(record)[ownerField.key];
      if (typeof ownerId !== "string" || !ownerId) continue;
      taskCounts.set(ownerId, (taskCounts.get(ownerId) ?? 0) + 1);
      for (const link of record.links) {
        if (link.targetType !== "SCHEDULE_ITEM") continue;
        const set = blocksByPerson.get(ownerId) ?? new Set<string>();
        set.add(link.targetId);
        blocksByPerson.set(ownerId, set);
      }
    }
  }
  const blockCounts = new Map(
    Array.from(blocksByPerson.entries()).map(([id, set]) => [id, set.size]),
  );

  const staffedIds = new Set([event.ownerId, ...event.members.map((m) => m.teamMemberId)]);
  const available = allTeamMembers.filter((member) => !staffedIds.has(member.id));
  const addMember = addEventMember.bind(null, eventId);

  const people = [
    { key: event.owner.id, member: event.owner, role: "OWNER", eventMemberId: null as string | null },
    ...event.members.map((m) => ({
      key: m.id,
      member: m.teamMember,
      role: m.role,
      eventMemberId: m.id,
    })),
  ];

  return (
    <div className="space-y-8">
      <div className="overflow-x-auto border border-rule bg-panel">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="h-head border-b border-rule bg-panel-alt">
              {["Person", "Owns on this event", "Role", ""].map((label, i) => (
                <th
                  key={label || i}
                  scope="col"
                  className={`px-4 text-micro font-medium uppercase text-ink-muted ${
                    i === 3 ? "text-right" : ""
                  }`}
                >
                  {label || <span className="sr-only">Actions</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-rule-soft">
            {people.map((person) => {
              const name = displayName(person.member.name, person.member.email);
              // Only show the email underneath when it isn't already the display name —
              // the old row printed the same address twice.
              const secondary = name === person.member.email ? null : person.member.email;
              const changeRole = person.eventMemberId
                ? updateEventMemberRole.bind(null, eventId, person.eventMemberId)
                : null;
              const remove = person.eventMemberId
                ? removeEventMember.bind(null, eventId, person.eventMemberId)
                : null;

              return (
                <tr key={person.key} className="h-row align-middle">
                  <td className="px-4 py-3">
                    <p className="text-[14px] text-ink">{name}</p>
                    {secondary && (
                      <a
                        href={`mailto:${secondary}`}
                        className="text-meta text-ink-muted hover:text-accent"
                      >
                        {secondary}
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-ink-muted">
                    {ownership(
                      taskCounts.get(person.member.id) ?? 0,
                      blockCounts.get(person.member.id) ?? 0,
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {changeRole ? (
                      <form action={changeRole} className="flex items-center gap-2">
                        <label className="sr-only" htmlFor={`role-${person.key}`}>
                          Role for {name}
                        </label>
                        <select
                          id={`role-${person.key}`}
                          name="role"
                          defaultValue={person.role}
                          className={field}
                        >
                          <option value="STAFF">Staff</option>
                          <option value="ORGANIZER">Organizer</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                        <button type="submit" className="text-meta text-ink-muted hover:text-ink">
                          Save
                        </button>
                      </form>
                    ) : (
                      <StatusDot status="OWNER" label="Owner" tone="accent" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {remove && (
                      <form action={remove}>
                        <button
                          type="submit"
                          className="text-meta text-ink-muted hover:text-danger"
                        >
                          Remove
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section>
        <h2 className="mb-2 text-micro uppercase text-ink-muted">Staff someone else</h2>
        {available.length === 0 ? (
          <p className="text-[13px] text-ink-muted">
            Everyone on the roster is already on this event.{" "}
            <a href="/team" className="text-accent hover:underline">
              Add a new person to the roster
            </a>{" "}
            first.
          </p>
        ) : (
          <form action={addMember} className="flex flex-wrap items-end gap-2">
            <div>
              <label className="mb-1 block text-caption text-ink-muted" htmlFor="add-member">
                Team member
              </label>
              <select id="add-member" name="teamMemberId" required defaultValue="" className={field}>
                <option value="" disabled>
                  Select…
                </option>
                {available.map((member) => (
                  <option key={member.id} value={member.id}>
                    {displayName(member.name, member.email)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-caption text-ink-muted" htmlFor="add-role">
                Role on this event
              </label>
              <select id="add-role" name="role" defaultValue="STAFF" className={field}>
                <option value="STAFF">Staff</option>
                <option value="ORGANIZER">Organizer</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <button
              type="submit"
              className="h-11 bg-accent px-4 text-ui text-panel transition-opacity hover:opacity-90"
            >
              Add to event
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
