import {
  Module,
} from '@nestjs/common';
import {
  ConfigModule,
  ConfigService,
} from '@nestjs/config';
import {
  JwtModule,
} from '@nestjs/jwt';

import {
  DatabaseModule,
} from '../database/database.module';
import {
  AdminAuthController,
} from './admin-auth.controller';
import {
  AuthController,
} from './auth.controller';
import {
  AuthService,
} from './auth.service';
import {
  AuthRoleGuard,
} from './guards/auth-role.guard';
import {
  JwtAuthGuard,
} from './guards/jwt-auth.guard';
import {
  PasswordHasherService,
} from './services/password-hasher.service';
import {
  TokenHasherService,
} from './services/token-hasher.service';

@Module({
  imports: [
    DatabaseModule,

    JwtModule.registerAsync({
      imports: [
        ConfigModule,
      ],
      inject: [
        ConfigService,
      ],
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

  controllers: [
    AuthController,
    AdminAuthController,
  ],

  providers: [
    AuthService,
    JwtAuthGuard,
    AuthRoleGuard,
    PasswordHasherService,
    TokenHasherService,
  ],

  exports: [
    JwtModule,
    AuthService,
    JwtAuthGuard,
    AuthRoleGuard,
    PasswordHasherService,
    TokenHasherService,
  ],
})
export class AuthModule {}
