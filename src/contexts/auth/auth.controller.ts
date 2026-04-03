import {
  Controller,
  Request,
  Post,
  UseGuards,
  Body,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import type { TokenResponse, AuthUser, LoginRequest } from '../shared/types/auth.types';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Authenticates user with email and password
   * @param req - Request containing authenticated user from LocalStrategy
   * @param loginDto - Login credentials for Swagger/validation
   * @returns JWT access token
   */
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(
    @Request() req: LoginRequest,
    @Body() loginDto: LoginDto
  ): Promise<TokenResponse> {
    return this.authService.login(req.user);
  }

  /**
   * Registers a new user
   * @param registerDto - User registration data
   * @returns Created user without password
   */
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }
}
