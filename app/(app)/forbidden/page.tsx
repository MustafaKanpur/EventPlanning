import Link from "next/link";

import { PageHeader } from "@/components/ui";

/** Where requireEventAccess sends a signed-in user who isn't on the event they acted on. */
export default function ForbiddenPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="You don't have permission to do this"
        subtitle="Only the event's owner, its team, or an admin can make changes to it."
      />
      <Link href="/dashboard" className="text-ui text-ink underline underline-offset-4">
        Back to your events
      </Link>
    </div>
  );
}
