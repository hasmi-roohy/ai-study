import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withApiHandler } from '@/lib/api/handler';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Za-z]/, 'Password must include at least one letter')
    .regex(/[0-9]/, 'Password must include at least one number'),
  name: z.string().min(1).optional()
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const ip = getClientIp(req);
  if (!checkRateLimit(`register:${ip}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many registration attempts. Please try again later.' }, { status: 429 });
  }

  const body = RegisterSchema.parse(await req.json());

  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) {
    return NextResponse.json({ error: 'An account with that email already exists' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(body.password, 10);
  const user = await prisma.user.create({
    data: { email: body.email, passwordHash, name: body.name }
  });

  return NextResponse.json({ id: user.id, email: user.email, name: user.name }, { status: 201 });
});
