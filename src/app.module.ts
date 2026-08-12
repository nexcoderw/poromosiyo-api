import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { validateEnvironment } from './config/environment.validation';
import { DatabaseModule } from './database/database.module';
import { AdminCatalogModule } from './admin/catalog/admin-catalog.module';
import { AdminGovernanceModule } from './admin/governance/admin-governance.module';
import { AdminDashboardModule } from './admin/dashboard/admin-dashboard.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    AdminGovernanceModule,
    AdminDashboardModule,
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),

    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 120,
      },
    ]),

    DatabaseModule,
    StorageModule,
    AuthModule,
    AdminCatalogModule,
  ],

  controllers: [AppController],

  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
