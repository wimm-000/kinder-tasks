import { z } from "zod";

export const offlineSyncSchema = z.object({
  requests: z
    .array(
      z.object({
        clientRequestId: z.string().uuid(),
        assignmentId: z.string().uuid(),
      }),
    )
    .max(50),
});

export const offlinePreferenceSchema = z.object({ enabled: z.boolean() });
