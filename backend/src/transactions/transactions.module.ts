import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service.js';
import { TransactionsController } from './transactions.controller.js';
import { ExchangeRateModule } from '../exchange-rate/exchange-rate.module.js';

@Module({
  imports: [ExchangeRateModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}
