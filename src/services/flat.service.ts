import { prisma } from "../db/index.js";
import { AppError } from "../utils/apiResponse.js";
import { generateInviteCode } from "../utils/inviteCode.js";
import { createFlatNotifications } from "./notification.service.js";

export async function createFlat(name: string, userId: string) {
  const existingMembership = await prisma.membership.findFirst({
    where: { userId, isActive: true },
  });
  if (existingMembership) {
    throw new AppError(409, "ALREADY_IN_FLAT", "You are already a member of a flat. Leave your current flat first.");
  }

  const inviteCode = generateInviteCode();

  const flat = await prisma.$transaction(async (tx) => {
    const newFlat = await tx.flat.create({
      data: { name, inviteCode, createdBy: userId },
    });

    await tx.membership.create({
      data: { flatId: newFlat.id, userId, role: "ADMIN" },
    });

    return newFlat;
  });

  return flat;
}

export async function joinFlat(inviteCode: string, userId: string) {
  // Case-insensitive lookup to handle legacy mixed-case codes
  const flat = await prisma.flat.findFirst({
    where: { inviteCode: { equals: inviteCode, mode: "insensitive" } },
  });
  if (!flat) {
    throw new AppError(404, "FLAT_NOT_FOUND", "No flat found with this invite code");
  }

  const existingMembership = await prisma.membership.findFirst({
    where: { userId, isActive: true },
  });
  if (existingMembership) {
    throw new AppError(409, "ALREADY_IN_FLAT", "You are already a member of a flat");
  }

  const alreadyInThisFlat = await prisma.membership.findUnique({
    where: { flatId_userId: { flatId: flat.id, userId } },
  });
  if (alreadyInThisFlat) {
    if (!alreadyInThisFlat.isActive) {
      throw new AppError(403, "CANNOT_REJOIN", "You cannot join this flat. You have been removed by an admin or you already left.");
    }
    throw new AppError(409, "ALREADY_MEMBER", "You are already a member of this flat");
  }

  const membership = await prisma.membership.create({
    data: { flatId: flat.id, userId, role: "MEMBER" },
  });

  // Get user details for notification
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

  if (user) {
    await createFlatNotifications(
      flat.id,
      userId,
      "MEMBER_JOINED",
      "New Roommate",
      `${user.name} joined the flat`
    );
  }

  return { flat, membership };
}

export async function getFlatDetails(flatId: string) {
  const flat = await prisma.flat.findUnique({
    where: { id: flatId },
    include: {
      memberships: {
        where: { isActive: true },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      },
      creator: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!flat) {
    throw new AppError(404, "FLAT_NOT_FOUND", "Flat not found");
  }

  return flat;
}

export async function getMembers(flatId: string) {
  const members = await prisma.membership.findMany({
    where: { flatId, isActive: true },
    include: {
      user: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  return members;
}

export async function removeMember(flatId: string, targetUserId: string, adminId: string) {
  if (targetUserId === adminId) {
    throw new AppError(400, "CANNOT_REMOVE_SELF", "Admin cannot remove themselves from the flat");
  }

  const membership = await prisma.membership.findUnique({
    where: { flatId_userId: { flatId, userId: targetUserId } },
  });

  if (!membership || !membership.isActive) {
    throw new AppError(404, "MEMBER_NOT_FOUND", "Member not found in this flat");
  }

  await prisma.membership.update({
    where: { id: membership.id },
    data: { isActive: false },
  });

  return { success: true };
}

export async function regenerateInviteCode(flatId: string) {
  const newCode = generateInviteCode();

  const flat = await prisma.flat.update({
    where: { id: flatId },
    data: { inviteCode: newCode },
  });

  return { inviteCode: flat.inviteCode };
}

export async function leaveFlat(flatId: string, userId: string) {
  const membership = await prisma.membership.findUnique({
    where: { flatId_userId: { flatId, userId } },
  });

  if (!membership || !membership.isActive) {
    throw new AppError(404, "MEMBER_NOT_FOUND", "You are not a member of this flat");
  }

  if (membership.role === "ADMIN") {
    throw new AppError(400, "CANNOT_LEAVE", "Admin cannot leave the flat without transferring ownership first");
  }

  await prisma.membership.update({
    where: { id: membership.id },
    data: { isActive: false },
  });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  if (user) {
    await createFlatNotifications(
      flatId,
      userId,
      "MEMBER_LEFT",
      "Roommate Left",
      `${user.name} left the flat`
    );
  }

  return { success: true };
}
