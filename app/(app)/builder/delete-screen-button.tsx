import { deleteScreen } from "./actions";

/** Inline confirm, matching the pattern used elsewhere for destructive actions. */
export function DeleteScreenButton({ eventId, screenId }: { eventId: string; screenId: string }) {
  return (
    <details className="relative">
      <summary className="flex h-11 cursor-pointer list-none items-center border border-rule px-3 text-ui text-danger transition-colors hover:bg-panel-alt">
        Delete screen
      </summary>
      <div className="absolute left-0 z-10 mt-1 w-72 border border-rule bg-panel p-4">
        <p className="text-[13px] text-ink">
          Delete this screen, its fields and every record on it? This can&apos;t be undone.
        </p>
        <form action={deleteScreen.bind(null, eventId, screenId)} className="mt-3">
          <button
            type="submit"
            className="h-11 bg-danger px-3 text-ui text-panel transition-opacity hover:opacity-90"
          >
            Yes, delete
          </button>
        </form>
      </div>
    </details>
  );
}
