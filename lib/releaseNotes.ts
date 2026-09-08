// lib/releaseNotes.ts
// In-app release notes, surfaced through the notification bell.
//
// WHY THESE ARE NOT KEYED TO APP VERSION:
// Over-the-air updates do not bump `version` in app.json. On 2026-09-08 four
// fixes shipped that way and the version stayed 1.2.18. Anything keyed to
// version would stay silent for exactly the kind of release this exists to
// announce. So each note carries its own hand-authored id and ships inside the
// same bundle as the change it describes, which means the two can never drift.
//
// DISCIPLINE: only add a note for something a user would notice or care about.
// If this fires for every internal fix, people learn to dismiss it without
// reading and the channel is spent.

export type ReleaseNote = {
  /** Stable and hand-authored. Never reuse or renumber an id. */
  id: string;
  /** YYYY-MM-DD. Drives ordering and the cutoff that hides history from new installs. */
  date: string;
  /** One line. What a user would actually notice. */
  title: string;
  /** Two or three plain sentences. No file names, no internals. */
  body: string;
  /** Omit to show everyone. Set when the change only affects a paid tier. */
  tier?: "pro" | "premium";
};

/** Newest first is not required here; sortedReleaseNotes() handles ordering. */
export const RELEASE_NOTES: ReleaseNote[] = [
  {
    id: "release-2026-09-08",
    date: "2026-09-08",
    title: "Contract numbering and payment terms",
    body:
      "Contracts were sometimes reusing the same number. That is fixed. " +
      "Payment Terms also moved higher up in the contract editor, so it is " +
      "easier to find before you send.",
    tier: "premium",
  },
];

/** Newest first. */
export function sortedReleaseNotes(): ReleaseNote[] {
  return [...RELEASE_NOTES].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
  );
}
