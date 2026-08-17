import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import {
  clearOfflineData,
  enqueueCompletion,
  listQueuedCompletions,
  readSnapshot,
  saveSnapshot,
  setOfflineEnabled,
  snapshotKey,
  updateCompletionStatus,
  type OfflineSnapshot,
} from "~/lib/offline/database";

const familyId = "0198b123-0000-7000-8000-000000000401";
const childId = "0198b123-0000-7000-8000-000000000402";

function snapshot(): OfflineSnapshot {
  return {
    key: snapshotKey(familyId, childId),
    familyId,
    childId,
    schemaVersion: 1,
    balanceCents: 2450,
    transactions: [],
    tasks: [{ assignmentId: "a", title: "Reciclaje", description: null, rewardCents: 150 }],
    syncedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
}

beforeEach(async () => clearOfflineData());

describe("offline database", () => {
  it("only saves snapshots after explicit opt-in", async () => {
    await saveSnapshot(snapshot());
    expect(await readSnapshot(familyId, childId)).toBeNull();
    await setOfflineEnabled(familyId, childId, true);
    await saveSnapshot(snapshot());
    expect(await readSnapshot(familyId, childId)).toMatchObject({ balanceCents: 2450 });
  });

  it("deduplicates queued requests by client request ID", async () => {
    const input = {
      clientRequestId: "0198b123-0000-7000-8000-000000000499",
      familyId,
      childId,
      assignmentId: "0198b123-0000-7000-8000-000000000498",
    };
    await enqueueCompletion(input);
    await enqueueCompletion(input);
    expect(await listQueuedCompletions()).toHaveLength(1);
    await updateCompletionStatus(input.clientRequestId, "syncing");
    expect(await listQueuedCompletions()).toHaveLength(1);
    await updateCompletionStatus(input.clientRequestId, "synced");
    expect(await listQueuedCompletions()).toHaveLength(0);
  });
});
