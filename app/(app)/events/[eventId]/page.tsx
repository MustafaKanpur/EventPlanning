import { redirect } from "next/navigation";

export default function EventHubIndex({ params }: { params: { eventId: string } }) {
  redirect(`/events/${params.eventId}/schedule`);
}
