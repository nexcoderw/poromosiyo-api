import { Module } from '@nestjs/common';
import {
  DatabasePackageModule,
  PrismaModule,
} from '@poromosiyo/db';

@Module({
  imports: [
    DatabasePackageModule,
    PrismaModule,
  ],
  exports: [
    DatabasePackageModule,
    PrismaModule,
  ],
})
export class DatabaseModule {}
