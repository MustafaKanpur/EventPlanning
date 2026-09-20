This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Two tiers: system screens and composed screens

Screens in this app come in two kinds, and the split is deliberate.

**System screens** stay native React pages, because they carry behaviour a generic
builder can't express: **Registration** (public sign-up form, payment status, revenue
posting) and **Budget** (allocation rollups, variance, revenue reconciliation). **Run of
show** is also native — it does gap detection, nests tasks under blocks, and links blocks
to budget lines.

**Composed screens** are `ScreenDefinition` rows: a name, a view type, and a set of
`FieldDefinition`s, rendered by one engine. Anything a user builds is a composed screen —
and so are the defaults an event is seeded with.

### The app's own task list is built from the primitives users get

There is no `Task` model. Tasks are a seeded **CHECKLIST** screen named "Tasks" with
fields `title`, `done`, `due`, `owner`, `block` and `budget` — exactly the field types
available in the builder, including the `LINK` fields that attach an item to a schedule
block or a budget line. Files works the same way, as a seeded TABLE screen.

That's the thesis, and it's testable: if the composed tier can carry the app's own task
system, it can carry whatever a street food festival or a conference needs.

The consequence is handled in one place. Run of show is native but renders tasks that
live in the composed tier, so both sides go through a single query helper,
`getRecordsLinkedTo(targetType, targetId)` in `lib/records.ts`, backed by the
`RecordLink` table rather than by scanning record JSON. The budget ledger and the
"Referenced by" panel call the same function.

Nested tasks are matched **by shape, not by name**: any CHECKLIST screen with a
`LINK → SCHEDULE_ITEM` field has its items nested under the matching block, labelled with
its screen name. Build an "AV Setup" checklist and it appears on the run of show without
configuring anything. Overdue is likewise one selector (`isRecordOverdue`), shared by the
dashboard, the run-of-show rail and the day-of view, so they can't drift apart.
