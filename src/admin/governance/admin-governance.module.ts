import { Module } from '@nestjs/common';

import { AuthModule } from '../../auth/auth.module';
import { DatabaseModule } from '../../database/database.module';
import { AdminAdminsController } from './controllers/admin-admins.controller';
import { AdminCustomersController } from './controllers/admin-customers.controller';
import { AccountGovernanceService } from './services/account-governance.service';
import { AdminAdminsService } from './services/admin-admins.service';
import { AdminCustomersService } from './services/admin-customers.service';
import { AdminUserActivitiesService } from './services/admin-user-activities.service';

@Module({
  imports: [DatabaseModule, AuthModule],

  controllers: [AdminCustomersController, AdminAdminsController],

  providers: [
    AccountGovernanceService,
    AdminCustomersService,
    AdminAdminsService,
    AdminUserActivitiesService,
  ],
})
export class AdminGovernanceModule {}
