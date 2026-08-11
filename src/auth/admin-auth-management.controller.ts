import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  Throttle,
} from '@nestjs/throttler';

import {
  AUTH_PASSWORD_RECOVERY_RATE_LIMIT,
  AUTH_PASSWORD_RECOVERY_RATE_WINDOW_MS,
} from './auth.constants';
import {
  CurrentUser,
} from './decorators/current-user.decorator';
import {
  RequireAuthRoles,
} from './decorators/require-auth-roles.decorator';
import {
  SetPasswordDto,
} from './dto/set-password.dto';
import {
  UnlinkGoogleDto,
} from './dto/unlink-google.dto';
import {
  AuthRoleGuard,
} from './guards/auth-role.guard';
import {
  JwtAuthGuard,
} from './guards/jwt-auth.guard';
import {
  AuthMethodManagementService,
} from './services/auth-method-management.service';
import {
  LocalPasswordService,
} from './services/local-password.service';
import {
  SessionManagementService,
} from './services/session-management.service';
import type {
  AuthenticationMethods,
  AuthSessionSummary,
} from './types/auth-management.types';
import type {
  AuthPrincipal,
} from './types/auth.types';

@Controller({
  path: 'admin',
  version: '1',
})
@RequireAuthRoles(
  'ADMIN',
)
@UseGuards(
  JwtAuthGuard,
  AuthRoleGuard,
)
export class AdminAuthManagementController {
  constructor(
    private readonly sessions:
      SessionManagementService,
    private readonly localPassword:
      LocalPasswordService,
    private readonly authMethods:
      AuthMethodManagementService,
  ) {}

  @Get('sessions')
  listSessions(
    @CurrentUser()
    user: AuthPrincipal,
  ): Promise<AuthSessionSummary[]> {
    return this.sessions
      .list(user);
  }

  @Delete(
    'sessions/:sessionId',
  )
  @HttpCode(
    HttpStatus.NO_CONTENT,
  )
  async revokeSession(
    @CurrentUser()
    user: AuthPrincipal,

    @Param(
      'sessionId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    sessionId: string,
  ): Promise<void> {
    await this.sessions
      .revoke(
        user,
        sessionId,
      );
  }

  @Post('logout-all')
  @HttpCode(
    HttpStatus.NO_CONTENT,
  )
  async logoutAll(
    @CurrentUser()
    user: AuthPrincipal,
  ): Promise<void> {
    await this.sessions
      .logoutAll(user);
  }

  @Get('methods')
  methods(
    @CurrentUser()
    user: AuthPrincipal,
  ): Promise<AuthenticationMethods> {
    return this.authMethods
      .getMethods(user);
  }

  @Post('set-password')
  @HttpCode(
    HttpStatus.NO_CONTENT,
  )
  @Throttle({
    default: {
      limit:
        AUTH_PASSWORD_RECOVERY_RATE_LIMIT,
      ttl:
        AUTH_PASSWORD_RECOVERY_RATE_WINDOW_MS,
    },
  })
  async setPassword(
    @CurrentUser()
    user: AuthPrincipal,
    @Body()
    dto: SetPasswordDto,
  ): Promise<void> {
    await this.localPassword
      .setPassword(
        user,
        dto.newPassword,
        dto.confirmPassword,
      );
  }

  @Post('google/unlink')
  @HttpCode(
    HttpStatus.NO_CONTENT,
  )
  @Throttle({
    default: {
      limit:
        AUTH_PASSWORD_RECOVERY_RATE_LIMIT,
      ttl:
        AUTH_PASSWORD_RECOVERY_RATE_WINDOW_MS,
    },
  })
  async unlinkGoogle(
    @CurrentUser()
    user: AuthPrincipal,
    @Body()
    dto: UnlinkGoogleDto,
  ): Promise<void> {
    await this.authMethods
      .unlinkGoogle(
        user,
        dto.currentPassword,
      );
  }
}
