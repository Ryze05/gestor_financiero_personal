import 'dotenv/config';
import { PrismaClient, Prisma } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.account.upsert({
    where: { name: 'Cuenta principal' },
    update: {},
    create: {
      name: 'Cuenta principal',
      initialBalance: new Prisma.Decimal('0'),
      currency: 'EUR',
    },
  });

  const categories = [
    { name: 'Alimentación', type: 'EXPENSE', color: '#ef4444' },
    { name: 'Restaurantes y bares', type: 'EXPENSE', color: '#f97316' },
    { name: 'Transporte', type: 'EXPENSE', color: '#3b82f6' },
    { name: 'Combustible', type: 'EXPENSE', color: '#6366f1' },
    { name: 'Alquiler / Hipoteca', type: 'EXPENSE', color: '#a16207' },
    { name: 'Suministros', type: 'EXPENSE', color: '#eab308' },
    { name: 'Hogar y mantenimiento', type: 'EXPENSE', color: '#78716c' },
    { name: 'Ocio', type: 'EXPENSE', color: '#8b5cf6' },
    { name: 'Suscripciones', type: 'EXPENSE', color: '#d946ef' },
    { name: 'Salud', type: 'EXPENSE', color: '#10b981' },
    { name: 'Educación', type: 'EXPENSE', color: '#14b8a6' },
    { name: 'Ropa', type: 'EXPENSE', color: '#ec4899' },
    { name: 'Cuidado personal', type: 'EXPENSE', color: '#f472b6' },
    { name: 'Regalos', type: 'EXPENSE', color: '#f43f5e' },
    { name: 'Viajes', type: 'EXPENSE', color: '#0ea5e9' },
    { name: 'Tecnología', type: 'EXPENSE', color: '#06b6d4' },
    { name: 'Seguros', type: 'EXPENSE', color: '#64748b' },
    { name: 'Otros gastos', type: 'EXPENSE', color: '#94a3b8' },
    { name: 'Salario', type: 'INCOME', color: '#22c55e' },
    { name: 'Freelance', type: 'INCOME', color: '#4ade80' },
    { name: 'Inversiones', type: 'INCOME', color: '#16a34a' },
    { name: 'Ventas', type: 'INCOME', color: '#84cc16' },
    { name: 'Otros ingresos', type: 'INCOME', color: '#a3e635' },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: {},
      create: {
        name: category.name,
        type: category.type as 'INCOME' | 'EXPENSE' | 'BOTH',
        color: category.color,
      },
    });
  }

  console.log('Seed completado: 1 cuenta y ' + categories.length + ' categorías.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());