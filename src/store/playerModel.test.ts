import { describe, it, expect, beforeEach } from 'vitest';
import { freshPlayerModel, loadPlayerModel, savePlayerModel } from './playerModel';
import { DB_VERSION, openTrainerDB } from './db';
import { resetDb } from '../test/resetDb';

describe('PlayerModel.conceptSeen (additive, no DB bump)', () => {
  beforeEach(resetDb);

  it('does NOT bump the schema version (still v4)', () => {
    expect(DB_VERSION).toBe(4);
  });

  it('freshPlayerModel seeds conceptSeen to an empty array', () => {
    const m = freshPlayerModel(1000);
    expect(m.conceptSeen).toEqual([]);
  });

  it('persists and reloads conceptSeen entries', async () => {
    const m = freshPlayerModel(1000);
    m.conceptSeen = ['fork', 'mate'];
    await savePlayerModel(m, 2000);
    const loaded = await loadPlayerModel(3000);
    expect(loaded.conceptSeen).toEqual(['fork', 'mate']);
  });

  it('an OLD record lacking conceptSeen loads, and consumers read it as [] via ?? []', async () => {
    // Simulate a pre-feature record written without conceptSeen.
    const db = await openTrainerDB();
    const legacy = freshPlayerModel(1000) as unknown as Record<string, unknown>;
    delete legacy.conceptSeen;
    await db.put('playerModel', legacy as never);
    const loaded = await loadPlayerModel(3000);
    expect(loaded.conceptSeen ?? []).toEqual([]);
  });
});
