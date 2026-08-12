import { Controller, Get, UseGuards } from '@nestjs/common';

import { RequireAuthRoles } from '../../auth/decorators/require-auth-roles.decorator';
import { AuthRoleGuard } from '../../auth/guards/auth-role.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminDashboardService } from './admin-dashboard.service';

@Controller({
  path: 'admin/dashboard',
  version: '1',
})
@RequireAuthRoles('ADMIN')
@UseGuards(JwtAuthGuard, AuthRoleGuard)
export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboardService) {}

  @Get()
  getDashboard() {
    return this.dashboard.getDashboard();
  }
}
