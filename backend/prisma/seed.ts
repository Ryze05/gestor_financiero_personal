import 'dotenv/config';
import { PrismaClient, Prisma } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Limpieza en orden de dependencias (FK onDelete: Restrict)
  await prisma.transfer.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.account.deleteMany();
  await prisma.category.deleteMany();

  // Cuentas
  const principal = await prisma.account.create({
    data: {
      name: 'Cuenta principal',
      initialBalance: new Prisma.Decimal('1000'),
      currency: 'EUR',
    },
  });
  const revolut = await prisma.account.create({
    data: {
      name: 'Revolut',
      initialBalance: new Prisma.Decimal('500'),
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

  // Movimientos de ejemplo (septiembre 2026)
  const txs = [
    { type: 'EXPENSE', amount: '56.30', currency: 'EUR', concept: 'Supermercado', date: '2026-09-02', category: 'Alimentación', account: principal },
    { type: 'EXPENSE', amount: '24.50', currency: 'EUR', concept: 'Cena con amigos', date: '2026-09-05', category: 'Restaurantes y bares', account: principal },
    { type: 'EXPENSE', amount: '45.00', currency: 'EUR', concept: 'Repostaje coche', date: '2026-09-08', category: 'Combustible', account: principal },
    { type: 'INCOME', amount: '1500.00', currency: 'EUR', concept: 'Nómina septiembre', date: '2026-09-01', category: 'Salario', account: principal },
    { type: 'EXPENSE', amount: '12.99', currency: 'EUR', concept: 'Suscripción streaming', date: '2026-09-10', category: 'Suscripciones', account: principal },
    { type: 'EXPENSE', amount: '89.99', currency: 'USD', concept: 'Compra online', date: '2026-09-12', category: 'Tecnología', account: revolut },
    { type: 'EXPENSE', amount: '18.40', currency: 'EUR', concept: 'Metro y bus', date: '2026-09-15', category: 'Transporte', account: principal },
  ] as const;

  for (const t of txs) {
    const currency = t.currency;
    const account = t.account;
    const accountCurrency = account.currency;
    let accountAmount = new Prisma.Decimal(t.amount);
    let exchangeRate = new Prisma.Decimal(1);
    if (currency !== accountCurrency) {
      exchangeRate = new Prisma.Decimal('1.05');
      accountAmount = new Prisma.Decimal(t.amount).mul(exchangeRate);
    }
    await prisma.transaction.create({
      data: {
        type: t.type,
        amount: new Prisma.Decimal(t.amount),
        currency,
        accountAmount,
        exchangeRate,
        concept: t.concept,
        date: new Date(t.date),
        source: 'WEB',
        accountId: account.id,
        categoryId: created[t.category],
      },
    });
  }

  console.log(
    `Seed completado: ${await prisma.account.count()} cuentas, ${await prisma.category.count()} categorías, ${await prisma.transaction.count()} movimientos.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());