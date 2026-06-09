import { prisma } from '../db/index.js';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/apiResponse.js';

interface AuthResult {
  user: { id: string; name: string; email: string; avatarUrl: string | null; createdAt: Date };
  token: string;
}

function generateToken(userId: string, email: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign({ userId, email }, secret, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

export async function signup(name: string, email: string, password: string): Promise<AuthResult> {
  // Check if email exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email already exists');
  
  // Hash with Bun.password (bcrypt, cost 12)
  const passwordHash = await Bun.password.hash(password, { algorithm: 'bcrypt', cost: 12 });
  
  const user = await prisma.user.create({
    data: { name, email, passwordHash },
    select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true },
  });
  
  const token = generateToken(user.id, user.email);
  return { user, token };
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  
  const valid = await Bun.password.verify(password, user.passwordHash);
  if (!valid) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  
  const token = generateToken(user.id, user.email);
  return {
    user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, createdAt: user.createdAt },
    token,
  };
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true },
  });
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  
  // Also fetch their active membership
  const membership = await prisma.membership.findFirst({
    where: { userId, isActive: true },
    include: { flat: { select: { id: true, name: true, inviteCode: true, currency: true } } },
  });
  
  return { ...user, membership: membership ? { ...membership, flat: membership.flat } : null };
}

export async function updateProfile(userId: string, name: string) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { name },
    select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true },
  });
  
  const membership = await prisma.membership.findFirst({
    where: { userId, isActive: true },
    include: { flat: { select: { id: true, name: true, inviteCode: true, currency: true } } },
  });
  
  return { ...user, membership: membership ? { ...membership, flat: membership.flat } : null };
}
