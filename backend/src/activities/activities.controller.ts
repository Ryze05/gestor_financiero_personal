import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ActivitiesService } from './activities.service.js';
import { ActivityQueryDto } from './dto/activity-query.dto.js';

@ApiTags('activities')
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar actividades (tickets agrupados + movimientos sueltos)',
  })
  @ApiOkResponse({ description: 'Actividades paginadas' })
  findAll(@Query() query: ActivityQueryDto) {
    return this.activitiesService.findAll(query);
  }
}