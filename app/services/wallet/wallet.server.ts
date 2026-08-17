import { and, desc, eq, sql } from "drizzle-orm";
import { data } from "react-router";
import { v7 as uuidv7 } from "uuid";

import { db } from "~/lib/db/client.server";
import { auditLogs, childProfiles, moneyTransactions } from "~/lib/db/schema";
import { requireChildContext } from "~/services/children/child-auth.server";
import { getChild } from "~/services/children/children.server";
import { requireFamilyParent } from "~/services/families/families.server";

async function walletData(familyId: string, childId: string) {
  const [balance] = await db
    .select({ value: sql<number>`coalesce(sum(${moneyTransactions.amountCents}), 0)` })
    .from(moneyTransactions)
    .where(and(eq(moneyTransactions.familyId, familyId), eq(moneyTransactions.childId, childId)));
  const transactions = await db
    .select({
      id: moneyTransactions.id,
      amountCents: moneyTransactions.amountCents,
      type: moneyTransactions.type,
      description: moneyTransactions.description,
      effectiveAt: moneyTransactions.effectiveAt,
    })
    .from(moneyTransactions)
    .where(and(eq(moneyTransactions.familyId, familyId), eq(moneyTransactions.childId, childId)))
    .orderBy(desc(moneyTransactions.effectiveAt), desc(moneyTransactions.id))
    .limit(50);
  return { balanceCents: Number(balance?.value ?? 0), transactions };
}

export async function getParentWallet(userId: string, familyId: string, childId: string) {
  const child = await getChild(userId, familyId, childId);
  return { ...child, ...(await walletData(familyId, childId)) };
}

export async function getChildWallet(request: Request) {
  const context = await requireChildContext(request);
  return { context, ...(await walletData(context.familyId, context.childId)) };
}

export async function listActiveChildrenForMoney(userId: string, familyId: string) {
  await getChildFamilyAccess(userId, familyId);
  return db
    .select({ id: childProfiles.id, alias: childProfiles.alias })
    .from(childProfiles)
    .where(and(eq(childProfiles.familyId, familyId), eq(childProfiles.status, "active")))
    .orderBy(childProfiles.alias);
}

async function getChildFamilyAccess(userId: string, familyId: string) {
  return requireFamilyParent(userId, familyId);
}

async function createDebit(input: {
  userId: string;
  familyId: string;
  childId: string;
  amountCents: number;
  description: string;
  type: "withdrawal" | "correction_debit";
}) {
  await getChild(input.userId, input.familyId, input.childId);
  const result = await db.transaction(async (tx) => {
    const [balance] = await tx
      .select({ value: sql<number>`coalesce(sum(${moneyTransactions.amountCents}), 0)` })
      .from(moneyTransactions)
      .where(
        and(
          eq(moneyTransactions.familyId, input.familyId),
          eq(moneyTransactions.childId, input.childId),
        ),
      );
    if (Number(balance?.value ?? 0) < input.amountCents) {
      await tx.insert(auditLogs).values({
        id: uuidv7(),
        familyId: input.familyId,
        actorType: "user",
        actorUserId: input.userId,
        action: "wallet.debit_denied",
        targetType: "child",
        targetId: input.childId,
        result: "denied",
        metadataJson: JSON.stringify({ reason: "insufficient_funds" }),
      });
      return false;
    }
    const id = uuidv7();
    await tx.insert(moneyTransactions).values({
      id,
      familyId: input.familyId,
      childId: input.childId,
      amountCents: -input.amountCents,
      type: input.type,
      description: input.description,
      createdByKind: "user",
      createdByUserId: input.userId,
      idempotencyKey: `${input.type}:${id}`,
      effectiveAt: new Date(),
    });
    await tx.insert(auditLogs).values({
      id: uuidv7(),
      familyId: input.familyId,
      actorType: "user",
      actorUserId: input.userId,
      action: `wallet.${input.type}.created`,
      targetType: "money_transaction",
      targetId: id,
      result: "success",
    });
    return true;
  });
  if (!result) throw data("El saldo disponible no es suficiente.", { status: 409 });
}

export function createWithdrawal(
  userId: string,
  familyId: string,
  childId: string,
  amountCents: number,
  description: string,
) {
  return createDebit({ userId, familyId, childId, amountCents, description, type: "withdrawal" });
}

export async function createAdjustment(
  userId: string,
  familyId: string,
  childId: string,
  kind: "credit" | "debit",
  amountCents: number,
  description: string,
) {
  if (kind === "debit")
    return createDebit({
      userId,
      familyId,
      childId,
      amountCents,
      description,
      type: "correction_debit",
    });
  await getChild(userId, familyId, childId);
  const id = uuidv7();
  await db.transaction(async (tx) => {
    await tx.insert(moneyTransactions).values({
      id,
      familyId,
      childId,
      amountCents,
      type: "correction_credit",
      description,
      createdByKind: "user",
      createdByUserId: userId,
      idempotencyKey: `correction_credit:${id}`,
      effectiveAt: new Date(),
    });
    await tx.insert(auditLogs).values({
      id: uuidv7(),
      familyId,
      actorType: "user",
      actorUserId: userId,
      action: "wallet.correction_credit.created",
      targetType: "money_transaction",
      targetId: id,
      result: "success",
    });
  });
}
