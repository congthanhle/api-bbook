// src/modules/auth/auth.controller.ts

import { Controller, Post, Get, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto';
import { CurrentUser, Public } from '../../common/decorators';
import { Throttle } from '@nestjs/throttler';

// Simple interface for swagger, not in barrel
class TokenResponseDto {
  access_token!: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // Stricter rate limit: 5 req/min
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login via Supabase email/password' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ description: 'JWT Access Token', type: TokenResponseDto })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout (client discards token)' })
  @ApiOkResponse({ description: 'Successfully logged out' })
  logout() {
    return { message: 'Logged out successfully' };
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiOkResponse({ description: 'Current User Profile' })
  getProfile(@CurrentUser() user: any) {
    return user;
  }
}
