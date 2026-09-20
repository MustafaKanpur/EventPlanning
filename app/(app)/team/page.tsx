import { prisma } from "@/lib/prisma";
import { createTeamMember, updateTeamMember } from "./actions";
import { TEAM_ROLE_STYLES } from "@/lib/status-styles";

export default async function TeamPage() {
  const teamMembers = await prisma.teamMember.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Team</h1>
        <p className="text-sm text-ink-muted">
          Your org-wide roster. Staff people onto individual events from each event&apos;s Team tab.
        </p>
      </div>

      <details className="group rounded-[3px] border border-rule bg-panel ">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-ink hover:bg-panel-alt">
          + Add team member
        </summary>
        <form
          action={createTeamMember}
          className="grid gap-3 border-t border-rule-soft px-4 py-3 sm:grid-cols-3"
        >
          <div className="space-y-1">
            <label className="text-xs font-medium text-ink-muted">Name</label>
            <input
              name="name"
              type="text"
              required
              placeholder="Jordan Lee"
              className="w-full rounded-[3px] border border-rule px-3 py-2 text-sm focus:border-accent focus:outline-none "
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-ink-muted">Email</label>
            <input
              name="email"
              type="email"
              required
              placeholder="jordan@organization.org"
              className="w-full rounded-[3px] border border-rule px-3 py-2 text-sm focus:border-accent focus:outline-none "
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-ink-muted">Role</label>
            <select
              name="role"
              defaultValue="STAFF"
              className="w-full rounded-[3px] border border-rule px-3 py-2 text-sm focus:border-accent focus:outline-none "
            >
              <option value="STAFF">Staff</option>
              <option value="ORGANIZER">Organizer</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div className="sm:col-span-3">
            <button
              type="submit"
              className="rounded-[3px] bg-accent px-4 py-2 text-sm font-medium text-panel transition hover:opacity-90"
            >
              Add
            </button>
          </div>
        </form>
      </details>

      {teamMembers.length === 0 ? (
        <div className="rounded-[3px] border border-rule bg-panel px-4 py-10">
          <p className="text-ink-muted">No team members yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-rule rounded-[3px] border border-rule bg-panel ">
          {teamMembers.map((member) => {
            const edit = updateTeamMember.bind(null, member.id);
            return (
              <div key={member.id} className="flex items-start justify-between gap-3 px-6 py-4">
                <div>
                  <p className="font-medium text-ink">{member.name}</p>
                  <p className="text-sm text-ink-muted">
                    {member.email}
                    {!member.userId && " · hasn't signed in yet"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${TEAM_ROLE_STYLES[member.role]}`}
                  >
                    {member.role}
                  </span>
                  <details>
                    <summary className="cursor-pointer list-none text-xs font-medium text-accent hover:text-ink">
                      Edit
                    </summary>
                    <form
                      action={edit}
                      className="mt-2 grid w-56 gap-2 rounded-[3px] border border-rule bg-panel-alt p-3"
                    >
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-ink-muted">Name</label>
                        <input
                          name="name"
                          required
                          defaultValue={member.name}
                          className="w-full rounded-[3px] border border-rule px-3 py-2 text-sm focus:border-accent focus:outline-none "
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-ink-muted">Role</label>
                        <select
                          name="role"
                          defaultValue={member.role}
                          className="w-full rounded-[3px] border border-rule px-3 py-2 text-sm focus:border-accent focus:outline-none "
                        >
                          <option value="STAFF">Staff</option>
                          <option value="ORGANIZER">Organizer</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      </div>
                      <button
                        type="submit"
                        className="rounded-[3px] bg-accent px-3 py-1.5 text-xs font-medium text-panel transition hover:opacity-90"
                      >
                        Save
                      </button>
                    </form>
                  </details>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
