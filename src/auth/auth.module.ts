import { Module } from '@nestjs/common';
import {
  ConfigModule,
  ConfigService,
} from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { DatabaseModule } from '../database/database.module';
import { PasswordHasherService } from './services/password-hasher.service';
import { TokenHasherService } from './services/token-hasher.service';

@Module({
  imports: [
    DatabaseModule,

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (
        config: ConfigService,
      ) => ({
        secret:
          config.getOrThrow<string>(
            'AUTH_ACCESS_TOKEN_SECRET',
          ),

        signOptions: {
          expiresIn:
            config.getOrThrow<number>(
              'AUTH_ACCESS_TOKEN_TTL_SECONDS',
            ),
        },
      }),
    }),
  ],

  providers: [
    PasswordHasherService,
    TokenHasherService,
  ],

  exports: [
    JwtModule,
    PasswordHasherService,
    TokenHasherService,
  ],
})
export class AuthModule {}
