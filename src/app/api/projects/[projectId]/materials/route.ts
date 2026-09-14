import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { withApiHandler } from '@/lib/api/handler';
import { assertProjectOwnership } from '@/lib/api/ownership';
import { enqueueJob } from '@/lib/jobs/queue';
import { recordActivity } from '@/lib/activity';
import { putMaterial } from '@/lib/storage/materials';

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

export const GET = withApiHandler(async (_req: NextRequest, context: { params: { projectId: string } | Promise<{ projectId: string }> }) => {
    const params = await context.params;
  const user = await requireUser();
  await assertProjectOwnership(params.projectId, user.id);

  const materials = await prisma.material.findMany({
    where: { projectId: params.projectId },
    orderBy: { createdAt: 'desc' }
  });

  return NextResponse.json({ materials });
});

export const POST = withApiHandler(async (req: NextRequest, context: { params: { projectId: string } | Promise<{ projectId: string }> }) => {
    const params = await context.params;
  const user = await requireUser();
  await assertProjectOwnership(params.projectId, user.id);

  const formData = await req.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'A "file" field with a PDF upload is required' }, { status: 400 });
  }
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Only PDF materials are supported in this prototype' }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: 'File exceeds the 20MB limit' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storagePath = await putMaterial(buffer, file.name);

  const material = await prisma.material.create({
    data: {
      projectId: params.projectId,
      userId: user.id,
      filename: file.name,
      storagePath,
      mimeType: file.type,
      status: 'QUEUED'
    }
  });

  await enqueueJob({
    type: 'PROCESS_MATERIAL',
    payload: { materialId: material.id },
    idempotencyKey: `process-material:${material.id}`
  });

  await recordActivity({
    userId: user.id,
    projectId: params.projectId,
    type: 'MATERIAL_UPLOADED',
    metadata: { materialId: material.id, filename: material.filename }
  });

  return NextResponse.json({ material }, { status: 201 });
});
