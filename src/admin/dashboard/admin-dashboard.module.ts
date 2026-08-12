import {
  Module,
} from '@nestjs/common';

import {
  AuthModule,
} from '../../auth/auth.module';
import {
  DatabaseModule,
} from '../../database/database.module';
import {
  AdminDashboardController,
} from './admin-dashboard.controller';
import {
  AdminDashboardService,
} from './admin-dashboard.service';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
  ],

  controllers: [
    AdminDashboardController,
  ],

  providers: [
    AdminDashboardService,
  ],
})
export class AdminDashboardModule {}
