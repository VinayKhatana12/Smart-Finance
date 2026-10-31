import { prisma } from '../db/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import type { CreateContributionInput, CreateGoalInput, UpdateGoalInput } from '../validation/v1.schema.js';

export interface GoalWithProgress {
  id: string;
  title: string;
  targetPaise: string;
  savedPaise: string;
  remainingPaise: string;
  percent: number;
  deadline: string | null;
  status: string;
  createdAt: string;
}

function withProgress(row: {
  id: string;
  title: string;
  targetPaise: bigint;
  deadline: Date | null;
  status: string;
  createdAt: Date;
  _count?: { contributions: number };
  contributions?: { amountPaise: bigint }[];
}): GoalWithProgress {
  const saved = row.contributions
    ? row.contributions.reduce((sum, c) => sum + c.amountPaise, 0n)
    : 0n;
  return {
    id: row.id,
    title: row.title,
    targetPaise: row.targetPaise.toString(),
    savedPaise: saved.toString(),
    remainingPaise: (row.targetPaise - saved > 0n ? row.targetPaise - saved : 0n).toString(),
    percent: row.targetPaise > 0n ? Math.min(100, Number((saved * 100n) / row.targetPaise)) : 0,
    deadline: row.deadline ? row.deadline.toISOString().slice(0, 10) : null,
    status: saved >= row.targetPaise && row.status !== 'ARCHIVED' ? 'ACHIEVED' : row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Saved amounts come from the contribution records, never from a stored total. */
export async function listGoals(userId: string): Promise<GoalWithProgress[]> {
  const rows = await prisma.savingsGoal.findMany({
    where: { userId },
    include: { contributions: { select: { amountPaise: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(withProgress);
}

async function assertOwnedGoal(userId: string, goalId: string): Promise<void> {
  const row = await prisma.savingsGoal.findFirst({ where: { id: goalId, userId }, select: { id: true } });
  if (!row) throw new ApiError(404, 'GOAL_NOT_FOUND', 'That goal does not exist.');
}

export async function createGoal(userId: string, input: CreateGoalInput): Promise<GoalWithProgress> {
  const row = await prisma.savingsGoal.create({
    data: {
      userId,
      title: input.title,
      targetPaise: BigInt(input.targetPaise),
      deadline: input.deadline ?? null,
    },
    include: { contributions: { select: { amountPaise: true } } },
  });
  return withProgress(row);
}

export async function updateGoal(userId: string, id: string, input: UpdateGoalInput): Promise<void> {
  const row = await prisma.savingsGoal.findFirst({ where: { id, userId }, select: { id: true } });
  if (!row) throw new ApiError(404, 'GOAL_NOT_FOUND', 'That goal does not exist.');
  await prisma.savingsGoal.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.targetPaise !== undefined ? { targetPaise: BigInt(input.targetPaise) } : {}),
      ...(input.deadline !== undefined ? { deadline: input.deadline } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
  });
}

export async function deleteGoal(userId: string, id: string): Promise<void> {
  const row = await prisma.savingsGoal.findFirst({ where: { id, userId }, select: { id: true } });
  if (!row) throw new ApiError(404, 'GOAL_NOT_FOUND', 'That goal does not exist.');
  await prisma.savingsGoal.delete({ where: { id } });
}

export async function addContribution(
  userId: string,
  goalId: string,
  input: CreateContributionInput,
): Promise<{ contribution: { id: string; amountPaise: string; notes: string; contributionDate: string }; savedPaise: string }> {
  await assertOwnedGoal(userId, goalId);
  const date = input.contributionDate ?? new Date();
  const [contribution, goal] = await prisma.$transaction([
    prisma.goalContribution.create({
      data: { goalId, userId, amountPaise: BigInt(input.amountPaise), notes: input.notes, contributionDate: date },
    }),
    prisma.savingsGoal.findFirst({ where: { id: goalId }, include: { contributions: { select: { amountPaise: true } } } }),
  ]);
  const saved = goal!.contributions.reduce((sum, c) => sum + c.amountPaise, 0n);
  if (saved >= goal!.targetPaise && goal!.status === 'ACTIVE') {
    await prisma.savingsGoal.update({ where: { id: goalId }, data: { status: 'ACHIEVED' } });
  }
  return {
    contribution: {
      id: contribution.id,
      amountPaise: contribution.amountPaise.toString(),
      notes: contribution.notes,
      contributionDate: contribution.contributionDate.toISOString(),
    },
    savedPaise: saved.toString(),
  };
}

export async function listContributions(userId: string, goalId: string) {
  await assertOwnedGoal(userId, goalId);
  const rows = await prisma.goalContribution.findMany({
    where: { goalId, userId },
    orderBy: { contributionDate: 'desc' },
    take: 50,
  });
  return rows.map((row) => ({
    id: row.id,
    goalId: row.goalId,
    amountPaise: row.amountPaise.toString(),
    notes: row.notes,
    contributionDate: row.contributionDate.toISOString(),
  }));
}
