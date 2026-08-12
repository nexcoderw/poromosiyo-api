import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import {
  AUTH_EMAIL_ACTION_RATE_LIMIT,
  AUTH_EMAIL_ACTION_RATE_WINDOW_MS,
  AUTH_LOGIN_RATE_LIMIT,
  AUTH_LOGIN_RATE_WINDOW_MS,
  AUTH_PASSWORD_RECOVERY_RATE_LIMIT,
  AUTH_PASSWORD_RECOVERY_RATE_WINDOW_MS,
  AUTH_REFRESH_RATE_LIMIT,
  AUTH_REFRESH_RATE_WINDOW_MS,
  AUTH_REGISTER_RATE_LIMIT,
  AUTH_REGISTER_RATE_WINDOW_MS,
  EMAIL_VERIFICATION_REQUEST_MESSAGE,
  PASSWORD_RESET_REQUEST_MESSAGE,
} from './auth.constants';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { RequireAuthRoles } from './decorators/require-auth-roles.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ConfirmEmailVerificationDto } from './dto/confirm-email-verification.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthRoleGuard } from './guards/auth-role.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { getSessionMetadata } from './request-metadata';
import { EmailVerificationService } from './services/email-verification.service';
import { PasswordRecoveryService } from './services/password-recovery.service';
import { ProfileImageService } from './services/profile-image.service';
import { IMAGE_UPLOAD_FIELD } from '../storage/image-storage.constants';
import { ApiImageUpload } from '../storage/api-image-upload.decorator';
import { imageUploadOptions } from '../storage/image-upload.options';
import type {
  AuthenticatedUser,
  AuthenticationResult,
  AuthPrincipal,
} from './types/auth.types';

type MessageResponse = {
  message: string;
};

@Controller({
  path: 'auth',
  version: '1',
})
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailVerification: EmailVerificationService,
    private readonly passwordRecovery: PasswordRecoveryService,
    private readonly profileImage: ProfileImageService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({
    default: {
      limit: AUTH_REGISTER_RATE_LIMIT,
      ttl: AUTH_REGISTER_RATE_WINDOW_MS,
    },
  })
  register(
    @Body()
    dto: RegisterDto,
    @Req()
    request: Request,
  ): Promise<AuthenticationResult> {
    return this.authService.registerCustomer(dto, getSessionMetadata(request));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: {
      limit: AUTH_LOGIN_RATE_LIMIT,
      ttl: AUTH_LOGIN_RATE_WINDOW_MS,
    },
  })
  login(
    @Body()
    dto: LoginDto,
    @Req()
    request: Request,
  ): Promise<AuthenticationResult> {
    return this.authService.loginCustomer(dto, getSessionMetadata(request));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: {
      limit: AUTH_REFRESH_RATE_LIMIT,
      ttl: AUTH_REFRESH_RATE_WINDOW_MS,
    },
  })
  refresh(
    @Body()
    dto: RefreshTokenDto,
  ): Promise<AuthenticationResult> {
    return this.authService.refreshCustomer(dto.refreshToken);
  }

  @Post('email-verification/resend')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({
    default: {
      limit: AUTH_EMAIL_ACTION_RATE_LIMIT,
      ttl: AUTH_EMAIL_ACTION_RATE_WINDOW_MS,
    },
  })
  @RequireAuthRoles('CUSTOMER')
  @UseGuards(JwtAuthGuard, AuthRoleGuard)
  async resendEmailVerification(
    @CurrentUser()
    user: AuthPrincipal,
    @Req()
    request: Request,
  ): Promise<MessageResponse> {
    await this.emailVerification.request(
      user.id,
      'CUSTOMER',
      getSessionMetadata(request),
    );

    return {
      message: EMAIL_VERIFICATION_REQUEST_MESSAGE,
    };
  }

  @Post('email-verification/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({
    default: {
      limit: AUTH_EMAIL_ACTION_RATE_LIMIT,
      ttl: AUTH_EMAIL_ACTION_RATE_WINDOW_MS,
    },
  })
  async confirmEmailVerification(
    @Body()
    dto: ConfirmEmailVerificationDto,
  ): Promise<void> {
    await this.emailVerification.confirm(dto.token, 'CUSTOMER');
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({
    default: {
      limit: AUTH_PASSWORD_RECOVERY_RATE_LIMIT,
      ttl: AUTH_PASSWORD_RECOVERY_RATE_WINDOW_MS,
    },
  })
  async forgotPassword(
    @Body()
    dto: ForgotPasswordDto,
    @Req()
    request: Request,
  ): Promise<MessageResponse> {
    await this.passwordRecovery.requestReset(
      dto.email,
      'CUSTOMER',
      getSessionMetadata(request),
    );

    return {
      message: PASSWORD_RESET_REQUEST_MESSAGE,
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({
    default: {
      limit: AUTH_PASSWORD_RECOVERY_RATE_LIMIT,
      ttl: AUTH_PASSWORD_RECOVERY_RATE_WINDOW_MS,
    },
  })
  async resetPassword(
    @Body()
    dto: ResetPasswordDto,
  ): Promise<void> {
    await this.passwordRecovery.resetPassword(
      dto.token,
      dto.newPassword,
      dto.confirmPassword,
      'CUSTOMER',
    );
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({
    default: {
      limit: AUTH_PASSWORD_RECOVERY_RATE_LIMIT,
      ttl: AUTH_PASSWORD_RECOVERY_RATE_WINDOW_MS,
    },
  })
  @RequireAuthRoles('CUSTOMER')
  @UseGuards(JwtAuthGuard, AuthRoleGuard)
  async changePassword(
    @CurrentUser()
    user: AuthPrincipal,
    @Body()
    dto: ChangePasswordDto,
  ): Promise<void> {
    await this.passwordRecovery.changePassword(
      user,
      dto.currentPassword,
      dto.newPassword,
      dto.confirmPassword,
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireAuthRoles('CUSTOMER')
  @UseGuards(JwtAuthGuard, AuthRoleGuard)
  async logout(
    @CurrentUser()
    user: AuthPrincipal,
  ): Promise<void> {
    await this.authService.logout(user);
  }

  @Get('me')
  @RequireAuthRoles('CUSTOMER')
  @UseGuards(JwtAuthGuard, AuthRoleGuard)
  me(
    @CurrentUser()
    user: AuthPrincipal,
  ): AuthenticatedUser {
    return toPublicUser(user);
  }

  @Post('me/image')
  @ApiImageUpload()
  @RequireAuthRoles('CUSTOMER')
  @UseGuards(JwtAuthGuard, AuthRoleGuard)
  @UseInterceptors(FileInterceptor(IMAGE_UPLOAD_FIELD, imageUploadOptions))
  updateProfileImage(
    @CurrentUser() user: AuthPrincipal,
    @UploadedFile() image: Express.Multer.File,
  ) {
    return this.profileImage.update(user, image);
  }
}

function toPublicUser(user: AuthPrincipal): AuthenticatedUser {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    image: user.image,
    role: user.role,
    emailVerified: user.emailVerified,
  };
}
