import type { Volunteer } from "@prisma/client";

import { GENDERS, dateInputValue } from "@/lib/volunteers";

const input =
  "w-full rounded-[3px] border border-rule bg-panel px-3 py-2 text-sm focus:border-accent focus:outline-none";

/** Name, contact and eligibility details. Parsed by readVolunteerForm. */
export function VolunteerFields({
  volunteer,
  lockEmail = false,
}: {
  volunteer?: Partial<Volunteer>;
  /** Email is the match key once a volunteer exists, so edits leave it alone. */
  lockEmail?: boolean;
}) {
  const row = (id: string, label: string, control: React.ReactNode, optional = true) => (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-ink-muted">
        {label}
        {optional && <span className="font-normal"> (optional)</span>}
      </label>
      {control}
    </div>
  );

  return (
    <>
      {row("v-name", "Name", <input id="v-name" name="name" required defaultValue={volunteer?.name} className={input} />, false)}
      {row(
        "v-email",
        "Email",
        <input
          id="v-email"
          name="email"
          type="email"
          required
          readOnly={lockEmail}
          defaultValue={volunteer?.email}
          className={`${input} ${lockEmail ? "text-ink-muted" : ""}`}
        />,
        false,
      )}
      {row("v-phone", "Phone", <input id="v-phone" name="phone" type="tel" defaultValue={volunteer?.phone ?? ""} className={input} />)}
      {row("v-address", "Address", <input id="v-address" name="address" autoComplete="street-address" defaultValue={volunteer?.address ?? ""} className={input} />)}
      {row(
        "v-birth",
        "Date of birth",
        <input id="v-birth" name="birthDate" type="date" defaultValue={dateInputValue(volunteer?.birthDate)} className={input} />,
      )}
      {row(
        "v-gender",
        "Gender",
        <select id="v-gender" name="gender" defaultValue={volunteer?.gender ?? ""} className={input}>
          <option value="">—</option>
          {GENDERS.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>,
      )}
    </>
  );
}
