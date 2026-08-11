import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { DatabaseModule } from '../database/database.module';
import { AdminAuthManagementController } from './admin-auth-management.controller';
import { AdminAuthController } from './admin-auth.controller';
import { AdminGoogleAuthController } from './admin-google-auth.controller';
import { AuthManagementController } from './auth-management.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleAuthController } from './google-auth.controller';
import { AuthRoleGuard } from './guards/auth-role.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthMailService } from './services/auth-mail.service';
import { AuthMethodManagementService } from './services/auth-method-management.service';
import { EmailVerificationService } from './services/email-verification.service';
import { GoogleAuthService } from './services/google-auth.service';
import { GoogleIdTokenVerifierService } from './services/google-id-token-verifier.service';
import { LocalPasswordService } from './services/local-password.service';
import { PasswordHasherService } from './services/password-hasher.service';
import { PasswordRecoveryService } from './services/password-recovery.service';
import { SessionManagementService } from './services/session-management.service';
import { TokenHasherService } from './services/token-hasher.service';

@Module({
  imports: [
    DatabaseModule,

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('AUTH_ACCESS_TOKEN_SECRET'),

        signOptions: {
          expiresIn: config.getOrThrow<number>('AUTH_ACCESS_TOKEN_TTL_SECONDS'),
        },
      }),
    }),
  ],

  controllers: [
    AuthController,
    GoogleAuthController,
    AuthManagementController,

    AdminAuthController,
    AdminGoogleAuthController,
    AdminAuthManagementController,
  ],

  providers: [
    AuthService,
    GoogleAuthService,
    GoogleIdTokenVerifierService,

    SessionManagementService,
    AuthMethodManagementService,
    LocalPasswordService,

    JwtAuthGuard,
    AuthRoleGuard,

    PasswordHasherService,
    TokenHasherService,

    AuthMailService,
    EmailVerificationService,
    PasswordRecoveryService,

    {
      provide:
        APP_INTERCEPTOR,
      useClass:
        AuthActivityInterceptor,
    },
  ],

  exports: [
    JwtModule,

    AuthService,
    GoogleAuthService,

    SessionManagementService,
    AuthMethodManagementService,
    LocalPasswordService,

    JwtAuthGuard,
    AuthRoleGuard,

    PasswordHasherService,
    TokenHasherService,
  ],
})
export class AuthModule {}
