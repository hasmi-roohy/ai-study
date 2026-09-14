import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash('AdminDemo123!', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@demo.local' },
    update: {},
    create: { email: 'admin@demo.local', passwordHash: adminPassword, name: 'Admin', role: 'ADMIN' }
  });

  const userPassword = await bcrypt.hash('LearnerDemo123!', 10);
  const learner = await prisma.user.upsert({
    where: { email: 'learner@demo.local' },
    update: {},
    create: { email: 'learner@demo.local', passwordHash: userPassword, name: 'Demo Learner' }
  });

  const space = await prisma.space.upsert({
    where: { id: 'demo-space' },
    update: {},
    create: { id: 'demo-space', userId: learner.id, name: 'Machine Learning', description: 'Foundational ML concepts' }
  });

  await prisma.project.upsert({
    where: { id: 'demo-project' },
    update: {},
    create: {
      id: 'demo-project',
      spaceId: space.id,
      userId: learner.id,
      name: 'Intro to Neural Networks',
      goal: 'Understand the fundamentals of neural networks well enough to explain them to a peer.'
    }
  });

  console.log('Seed complete.');
  console.log('Admin login:   admin@demo.local / AdminDemo123!');
  console.log('Learner login: learner@demo.local / LearnerDemo123!');
  console.log('Upload a PDF into "Intro to Neural Networks" to see the full loop.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
