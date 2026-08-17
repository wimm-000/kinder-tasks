import { and, eq } from "drizzle-orm";

import { auth } from "../app/lib/auth/auth.server";
import { db, databaseClient } from "../app/lib/db/client.server";
import {
  childCredentials,
  childProfiles,
  families,
  familyMembers,
  allowanceSchedules,
  moneyTransactions,
  taskAssignments,
  tasks,
  user,
  userProfiles,
} from "../app/lib/db/schema";
import { v7 as uuidv7 } from "uuid";
import { hashChildPin } from "../app/lib/auth/child-pin.server";

if (process.env.NODE_ENV === "production") {
  throw new Error("The development seed cannot run in production");
}

const email = process.env.SEED_PARENT_EMAIL ?? "paula.robles@example.test";
const password = process.env.SEED_PARENT_PASSWORD ?? "FamiliaRobles2026!";
const name = "Paula Robles";

let existingUser = await db.query.user.findFirst({
  where: eq(user.email, email),
  columns: { id: true },
});

if (!existingUser) {
  const result = await auth.api.signUpEmail({
    body: { name, email, password, callbackURL: "/verify-email?verified=1" },
  });
  existingUser = { id: result.user.id };
}

await db.update(user).set({ name, emailVerified: true }).where(eq(user.id, existingUser.id));
await db
  .insert(userProfiles)
  .values({ userId: existingUser.id })
  .onConflictDoNothing({ target: userProfiles.userId });

let family = await db.query.families.findFirst({
  where: eq(families.name, "Familia Robles"),
  columns: { id: true },
});
if (!family) {
  family = { id: uuidv7() };
  await db
    .insert(families)
    .values({ id: family.id, name: "Familia Robles", createdByUserId: existingUser.id });
}
await db
  .insert(familyMembers)
  .values({ id: uuidv7(), familyId: family.id, userId: existingUser.id })
  .onConflictDoNothing();

const seededChildren = [
  { alias: "Leo", avatarKey: "fox", profileColor: "teal", pin: "2468" },
  { alias: "Nora", avatarKey: "rabbit", profileColor: "coral", pin: "1357" },
];
for (const child of seededChildren) {
  const existing = await db.query.childProfiles.findFirst({
    where: and(eq(childProfiles.familyId, family.id), eq(childProfiles.alias, child.alias)),
    columns: { id: true },
  });
  if (!existing) {
    const childId = uuidv7();
    await db.insert(childProfiles).values({
      id: childId,
      familyId: family.id,
      alias: child.alias,
      avatarKey: child.avatarKey,
      profileColor: child.profileColor,
    });
    await db
      .insert(childCredentials)
      .values({ childId, familyId: family.id, pinHash: await hashChildPin(child.pin) });
  }
}

const leo = await db.query.childProfiles.findFirst({
  where: and(eq(childProfiles.familyId, family.id), eq(childProfiles.alias, "Leo")),
  columns: { id: true },
});
const nora = await db.query.childProfiles.findFirst({
  where: and(eq(childProfiles.familyId, family.id), eq(childProfiles.alias, "Nora")),
  columns: { id: true },
});
if (leo) {
  await db
    .insert(moneyTransactions)
    .values([
      {
        id: uuidv7(),
        familyId: family.id,
        childId: leo.id,
        amountCents: 3250,
        type: "correction_credit",
        description: "Saldo inicial acordado",
        createdByKind: "user",
        createdByUserId: existingUser.id,
        idempotencyKey: "seed:leo:initial",
        effectiveAt: new Date("2026-08-10T10:00:00Z"),
      },
      {
        id: uuidv7(),
        familyId: family.id,
        childId: leo.id,
        amountCents: -800,
        type: "withdrawal",
        description: "Comprar un libro",
        createdByKind: "user",
        createdByUserId: existingUser.id,
        idempotencyKey: "seed:leo:book",
        effectiveAt: new Date("2026-08-15T10:00:00Z"),
      },
    ])
    .onConflictDoNothing();
}
if (
  nora &&
  !(await db.query.allowanceSchedules.findFirst({ where: eq(allowanceSchedules.childId, nora.id) }))
) {
  await db.insert(allowanceSchedules).values({
    id: uuidv7(),
    familyId: family.id,
    childId: nora.id,
    amountCents: 500,
    frequency: "monthly",
    monthDay: 1,
    startDate: "2026-09-01",
    nextRunAt: new Date("2026-08-31T22:00:00Z"),
  });
}

if (leo) {
  let recyclingTask = await db.query.tasks.findFirst({
    where: and(eq(tasks.familyId, family.id), eq(tasks.title, "Bajar el reciclaje")),
    columns: { id: true },
  });
  if (!recyclingTask) {
    recyclingTask = { id: uuidv7() };
    await db.insert(tasks).values({
      id: recyclingTask.id,
      familyId: family.id,
      title: "Bajar el reciclaje",
      description: "Separa los envases y baja la bolsa al contenedor amarillo.",
      type: "open",
      rewardCents: 150,
      openLimitCount: 3,
      openLimitPeriod: "week",
      createdByUserId: existingUser.id,
    });
  }
  await db
    .insert(taskAssignments)
    .values({ id: uuidv7(), familyId: family.id, taskId: recyclingTask.id, childId: leo.id })
    .onConflictDoNothing();
}

console.info(`Development parent ready: ${email}`);
databaseClient.close();
