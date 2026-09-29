import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envValidationSchema } from './config/env.validation.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { AccountsModule } from './accounts/accounts.module.js';
import { TransactionsModule } from './transactions/transactions.module.js';
import { TransfersModule } from './transfers/transfers.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { ExchangeRateModule } from './exchange-rate/exchange-rate.module.js';
import { ReceiptsModule } from './receipts/receipts.module.js';
import { ActivitiesModule } from './activities/activities.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      validationSchema: envValidationSchema,
    }),
    PrismaModule,
    HealthModule,
    CategoriesModule,
    AccountsModule,
    TransactionsModule,
    TransfersModule,
    DashboardModule,
    ExchangeRateModule,
    ReceiptsModule,
    ActivitiesModule,
  ],
})
export class AppModule {}