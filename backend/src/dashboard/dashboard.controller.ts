import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service.js';
import { DashboardQueryDto } from './dto/dashboard-query.dto.js';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  get(@Query() query: DashboardQueryDto) {
    return this.dashboardService.get(query);
  }
}