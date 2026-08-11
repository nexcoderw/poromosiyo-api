import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import {
  AUTH_LOGIN_RATE_LIMIT,
  AUTH_LOGIN_RATE_WINDOW_MS,
} from './auth.constants';
import { CurrentUser } from './decorators/current-user.decorator';
import { RequireAuthRoles } from './decorators/require-auth-roles.decorator';
import { GoogleIdTokenDto } from './dto/google-id-token.dto';
import { AuthRoleGuard } from './guards/auth-role.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { getSessionMetadata } from './request-metadata';
import { GoogleAuthService } from './services/google-auth.service';
import type { AuthenticationResult, AuthPrincipal } from './types/auth.types';

@Controller({
  path: 'auth',
  version: '1',
})
export class GoogleAuthController {
  constructor(private readonly googleAuth: GoogleAuthService) {}

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: {
      limit: AUTH_LOGIN_RATE_LIMIT,
      ttl: AUTH_LOGIN_RATE_WINDOW_MS,
    },
  })
  login(
    @Body()
    dto: GoogleIdTokenDto,
    @Req()
    request: Request,
  ): Promise<AuthenticationResult> {
    return this.googleAuth.loginCustomer(
      dto.idToken,
      getSessionMetadata(request),
    );
  }

  @Post('google/link')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireAuthRoles('CUSTOMER')
  @UseGuards(JwtAuthGuard, AuthRoleGuard)
  async link(
    @CurrentUser()
    user: AuthPrincipal,
    @Body()
    dto: GoogleIdTokenDto,
  ): Promise<void> {
    await this.googleAuth.linkCustomer(user, dto.idToken);
  }
}
