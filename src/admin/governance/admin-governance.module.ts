import { Module } from '@nestjs/common';

import { AuthModule } from '../../auth/auth.module';
import { DatabaseModule } from '../../database/database.module';
import { AdminActivitiesController } from './controllers/admin-activities.controller';
import { AdminAdminsController } from './controllers/admin-admins.controller';
import { AdminCustomersController } from './controllers/admin-customers.controller';
import { AccountGovernanceService } from './services/account-governance.service';
import { AdminAdminsService } from './services/admin-admins.service';
import { AdminCustomersService } from './services/admin-customers.service';
import { AdminManagedSessionsService } from './services/admin-managed-sessions.service';
import { AdminUserActivitiesService } from './services/admin-user-activities.service';

@Module({
  imports: [DatabaseModule, AuthModule],

  controllers: [
    AdminCustomersController,
    AdminAdminsController,
    AdminActivitiesController,
  ],

  providers: [
    AccountGovernanceService,
    AdminCustomersService,
    AdminAdminsService,
    AdminUserActivitiesService,
    AdminManagedSessionsService,
  ],
})
export class AdminGovernanceModule {}
