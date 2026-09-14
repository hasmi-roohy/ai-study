import { prisma } from '@/lib/db';

/** PRD §52 Security & Data Isolation: every project-scoped route must call this before touching data. */
export async function assertProjectOwnership(projectId: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    include: { space: { select: { id: true, name: true } } }
  });
  if (!project) {
    const err: any = new Error('Project not found');
    err.status = 404;
    throw err;
  }
  return project;
}
