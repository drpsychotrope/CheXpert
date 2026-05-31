// FSRS card storage types (Phase 3, ADR-0010/ADR-0011).
//
// ts-fsrs Card carries Date fields (due, last_review). We persist Dates as epoch
// ms so IndexedDB storage and unit tests are deterministic and structured-clone
// edge cases never bite. Conversion happens at the boundary in srs/fsrs.ts.

export type SrsItemKind = 'puzzle' | 'repertoire';

export interface SrsCardRecord {
  /** Unique card id: `${kind}:${refId}`. */
  id: string;
  kind: SrsItemKind;
  /** The trained item: a puzzle id, or a repertoire-line id. */
  refId: string;

  // --- FSRS Card fields (Dates stored as epoch ms) ---
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number; // ts-fsrs State enum (0 New,1 Learning,2 Review,3 Relearning)
  last_review: number | null;

  createdAt: number;
}
