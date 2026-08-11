import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  Throttle,
} from '@nestjs/throttler';
import type {
  Request,
} from 'express';

import {
  AUTH_LOGIN_RATE_LIMIT,
  AUTH_LOGIN_RATE_WINDOW_MS,
  AUTH_REFRESH_RATE_LIMIT,
  AUTH_REFRESH_RATE_WINDOW_MS,
} from './auth.constants';
import {
  AuthService,
} from './auth.service';
import {
  CurrentUser,
} from './decorators/current-user.decorator';
import {
  RequireAuthRoles,
} from './decorators/require-auth-roles.decorator';
import {
  LoginDto,
} from './dto/login.dto';
import {
  RefreshTokenDto,
} from './dto/refresh-token.dto';
import {
  AuthRoleGuard,
} from './guards/auth-role.guard';
import {
  JwtAuthGuard,
} from './guards/jwt-auth.guard';
import {
  getSessionMetadata,
} from './request-metadata';
import type {
  AuthenticatedUser,
  AuthenticationResult,
  AuthPrincipal,
} from './types/auth.types';

@Controller({
  path: 'admin',
  version: '1',
})
export class AdminAuthController {
  constructor(
    private readonly authService:
      AuthService,
  ) {}

  @Post('login')
  @HttpCode(
    HttpStatus.OK,
  )
  @Throttle({
    default: {
      limit:
        AUTH_LOGIN_RATE_LIMIT,
      ttl:
        AUTH_LOGIN_RATE_WINDOW_MS,
    },
  })
  login(
    @Body()
    dto: LoginDto,
    @Req()
    request: Request,
  ): Promise<AuthenticationResult> {
    return this.authService
      .loginAdmin(
        dto,
        getSessionMetadata(
          request,
        ),
      );
  }

  @Post('refresh')
  @HttpCode(
    HttpStatus.OK,
  )
  @Throttle({
    default: {
      limit:
        AUTH_REFRESH_RATE_LIMIT,
      ttl:
        AUTH_REFRESH_RATE_WINDOW_MS,
    },
  })
  refresh(
    @Body()
    dto: RefreshTokenDto,
  ): Promise<AuthenticationResult> {
    return this.authService
      .refreshAdmin(
        dto.refreshToken,
      );
  }

  @Post('logout')
  @HttpCode(
    HttpStatus.NO_CONTENT,
  )
  @RequireAuthRoles(
    'ADMIN',
  )
  @UseGuards(
    JwtAuthGuard,
    AuthRoleGuard,
  )
  async logout(
    @CurrentUser()
    user: AuthPrincipal,
  ): Promise<void> {
    await this.authService
      .logout(user);
  }

  @Get('me')
  @RequireAuthRoles(
    'ADMIN',
  )
  @UseGuards(
    JwtAuthGuard,
    AuthRoleGuard,
  )
  me(
    @CurrentUser()
    user: AuthPrincipal,
  ): AuthenticatedUser {
    return toPublicUser(user);
  }
}

function toPublicUser(
  user: AuthPrincipal,
): AuthenticatedUser {
  return {
    id:
      user.id,
    fullName:
      user.fullName,
    email:
      user.email,
    image:
      user.image,
    role:
      user.role,
    emailVerified:
      user.emailVerified,
  };
}
