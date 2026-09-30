import 'dotenv/config';
import { PrismaClient, Prisma } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Limpieza en orden de dependencias (FK onDelete: Restrict)
  await prisma.transfer.deleteMany();
  await prisma.receipt.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.account.deleteMany();
  await prisma.category.deleteMany();

  // Cuentas
  const principal = await prisma.account.create({
    data: {
      name: 'Cuenta principal',
      initialBalance: new Prisma.Decimal('0'),
      currency: 'EUR',
    },
  });
  const revolut = await prisma.account.create({
    data: {
      name: 'Revolut',
      initialBalance: new Prisma.Decimal('0'),
      currency: 'USD',
    },
  });

  // Categorías
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
    { name: 'Transferencias', type: 'BOTH', color: '#7c3aed' },
  ];

  const created: Record<string, string> = {};
  for (const category of categories) {
    const c = await prisma.category.create({
      data: {
        name: category.name,
        type: category.type as 'INCOME' | 'EXPENSE' | 'BOTH',
        color: category.color,
      },
    });
    created[c.name] = c.id;
  }

  // Movimientos de ejemplo (agosto y septiembre 2026)
  const txs = [
    // Cuenta principal (EUR)
    { type: 'INCOME', amount: '1500.00', concept: 'Nómina', date: '2026-09-01', category: 'Salario', account: principal },
    { type: 'INCOME', amount: '250.00', concept: 'Proyecto freelance', date: '2026-09-15', category: 'Freelance', account: principal },
    { type: 'EXPENSE', amount: '650.00', concept: 'Alquiler', date: '2026-09-01', category: 'Alquiler / Hipoteca', account: principal },
    { type: 'EXPENSE', amount: '56.30', concept: 'Supermercado', date: '2026-09-06', category: 'Alimentación', account: principal },
    { type: 'EXPENSE', amount: '35.00', concept: 'Ocio / cine', date: '2026-09-20', category: 'Ocio', account: principal },
    // Revolut (USD)
    { type: 'INCOME', amount: '140.00', concept: 'Ventas online', date: '2026-09-05', category: 'Ventas', account: revolut },
    { type: 'EXPENSE', amount: '89.99', concept: 'Compra online', date: '2026-09-12', category: 'Tecnología', account: revolut },
  ] as const;

  for (const t of txs) {
    const currency = t.account.currency;
    const accountAmount = new Prisma.Decimal(t.amount);
    await prisma.transaction.create({
      data: {
        type: t.type,
        amount: new Prisma.Decimal(t.amount),
        currency,
        accountAmount,
        exchangeRate: new Prisma.Decimal(1),
        concept: t.concept,
        date: new Date(t.date),
        source: 'WEB',
        accountId: t.account.id,
        categoryId: created[t.category],
      },
    });
  }

  // Ticket de ejemplo (Nivel 2): una compra dividida por categorías
  const carrefour = await prisma.receipt.create({
    data: {
      externalId: 'seed-ticket-carrefour-001',
      merchant: 'Carrefour',
      date: new Date('2026-09-21'),
      total: new Prisma.Decimal('19.00'),
      currency: 'EUR',
      accountId: principal.id,
      source: 'WEB',
    },
  });

  const carrefourLines = [
    { amount: '2.00', concept: 'Pan', category: 'Alimentación' },
    { amount: '7.00', concept: 'Camiseta', category: 'Ropa' },
    { amount: '10.00', concept: 'Crema de cara', category: 'Cuidado personal' },
  ];
  for (const line of carrefourLines) {
    await prisma.transaction.create({
      data: {
        type: 'EXPENSE',
        amount: new Prisma.Decimal(line.amount),
        currency: 'EUR',
        accountAmount: new Prisma.Decimal(line.amount),
        exchangeRate: new Prisma.Decimal(1),
        concept: line.concept,
        date: new Date('2026-09-21'),
        source: 'WEB',
        accountId: principal.id,
        categoryId: created[line.category],
        receiptId: carrefour.id,
      },
    });
  }

  console.log(
    `Seed completado: ${await prisma.account.count()} cuentas, ${await prisma.category.count()} categorías, ${await prisma.transaction.count()} movimientos, ${await prisma.receipt.count()} tickets.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
