import { VolunteerFields } from "@/components/volunteer-fields";
import { joinAsVolunteer } from "./actions";

export default function VolunteerSignupPage({ searchParams }: { searchParams: { success?: string } }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ground px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-white/10 bg-panel p-8">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-ink">Volunteer with us</h1>
          <p className="text-sm text-ink-muted">Leave your details and the team will be in touch.</p>
        </div>
        {searchParams.success === "1" ? (
          <p className="border border-rule bg-panel-alt px-4 py-3 text-center text-sm text-ink">
            Thanks! Your sign-up is waiting for approval.
          </p>
        ) : (
          <form action={joinAsVolunteer} className="space-y-4">
            <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
            <VolunteerFields />
            <button
              type="submit"
              className="w-full rounded-[3px] bg-accent px-4 py-2 text-sm font-medium text-panel transition hover:opacity-90"
            >
              Sign up
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
