import type { Executor } from "./db/client";
import { auditEvents } from "./db/schema";

type AuditInput = {
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  /** Small, non-sensitive facts only: never passwords, tokens or manuscript text. */
  metadata?: Record<string, string | number | boolean | null>;
};

export async function audit(db: Executor, input: AuditInput) {
  await db.insert(auditEvents).values({
    actorId: input.actorId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    metadata: input.metadata ?? {},
  });
}
