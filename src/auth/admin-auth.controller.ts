import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import {
  AUTH_LOGIN_RATE_LIMIT,
  AUTH_LOGIN_RATE_WINDOW_MS,
} from './auth.constants';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { getSessionMetadata } from './request-metadata';
import type { AuthenticationResult } from './types/auth.types';

@Controller({
  path: 'admin',
  version: '1',
})
export class AdminAuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: {
      limit: AUTH_LOGIN_RATE_LIMIT,
      ttl: AUTH_LOGIN_RATE_WINDOW_MS,
    },
  })
  login(
    @Body() dto: LoginDto,
    @Req() request: Request,
  ): Promise<AuthenticationResult> {
    return this.authService.loginAdmin(dto, getSessionMetadata(request));
  }
}
