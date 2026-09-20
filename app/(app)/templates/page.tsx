import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { ensureBuiltInTemplates } from "@/lib/templates";
import { PageHeader } from "@/components/ui";
import { deleteTemplate } from "./actions";

export default async function TemplatesPage() {
  await ensureBuiltInTemplates();

  const templates = await prisma.template.findMany({
    include: {
      screens: {
        select: { name: true, viewType: true, _count: { select: { fields: true } } },
        orderBy: { position: "asc" },
      },
    },
    orderBy: [{ isBuiltIn: "desc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Templates"
        subtitle="A named set of screens with no records. Start an event from one, or bottle an event you have already run."
        actions={
          <Link
            href="/events/new"
            className="flex h-11 items-center border border-rule px-3 text-ui text-ink transition-colors hover:bg-panel-alt"
          >
            + Create event
          </Link>
        }
      />

      <div className="overflow-x-auto border border-rule bg-panel">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="h-head border-b border-rule bg-panel-alt">
              {["Template", "Screens", "Source", ""].map((label, i) => (
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
            {templates.map((template) => (
              <tr key={template.id} className="align-top">
                <td className="px-4 py-4">
                  <p className="text-[14px] text-ink">{template.name}</p>
                  {template.description && (
                    <p className="mt-0.5 text-meta text-ink-muted">{template.description}</p>
                  )}
                </td>
                <td className="px-4 py-4">
                  <p className="font-mono text-caption tabular-nums text-ink">
                    {template.screens.length}
                  </p>
                  <p className="text-meta text-ink-muted">
                    {template.screens
                      .map((s) => `${s.name} (${s.viewType.toLowerCase()})`)
                      .join(" · ")}
                  </p>
                </td>
                <td className="px-4 py-4 text-[13px] text-ink-muted">
                  {template.isBuiltIn ? "Built in" : "Saved from an event"}
                </td>
                <td className="px-4 py-4 text-right">
                  <Link
                    href={`/events/new?template=${template.id}`}
                    className="text-[13px] text-accent hover:underline"
                  >
                    Use this →
                  </Link>
                  {!template.isBuiltIn && (
                    <form action={deleteTemplate.bind(null, template.id)} className="mt-1">
                      <button
                        type="submit"
                        className="text-meta text-ink-muted hover:text-danger"
                      >
                        Delete
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
