// Opening repertoire types (Phase 3). A repertoire line is a named sequence of
// moves the player commits to, drilled under FSRS like flashcards.

export interface RepertoireLine {
  id: string;
  /** Side the player trains this line as. */
  color: 'w' | 'b';
  /** Display name, e.g. "Italian — Giuoco Piano". */
  name: string;
  /** Opening ECO/name tag from Lichess chess-openings, if matched. */
  opening?: string;
  /** The line as UCI moves from the start position (both sides). */
  moves: string[];
  /** SAN moves, parallel to `moves`, for display. */
  san: string[];
  createdAt: number;
}
