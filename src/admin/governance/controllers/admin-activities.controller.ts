import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  RequireAuthRoles,
} from '../../../auth/decorators/require-auth-roles.decorator';
import {
  AuthRoleGuard,
} from '../../../auth/guards/auth-role.guard';
import {
  JwtAuthGuard,
} from '../../../auth/guards/jwt-auth.guard';
import {
  ListGlobalActivitiesDto,
} from '../dto/list-global-activities.dto';
import {
  AdminUserActivitiesService,
} from '../services/admin-user-activities.service';

@Controller({
  path: 'admin/activities',
  version: '1',
})
@RequireAuthRoles('ADMIN')
@UseGuards(
  JwtAuthGuard,
  AuthRoleGuard,
)
export class AdminActivitiesController {
  constructor(
    private readonly activities:
      AdminUserActivitiesService,
  ) {}

  @Get()
  list(
    @Query()
    query:
      ListGlobalActivitiesDto,
  ) {
    return this.activities.listAll(
      query,
    );
  }
}
