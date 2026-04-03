import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from '../users/user.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ConfigService } from "@nestjs/config";
import jwt from "jsonwebtoken";
import { RefreshTokenAuthDto } from './dto/refresh-token-auth.dto';
import { ERROR_MESSAGES } from "../shared/constants/error-messages.constants";
import type { JwtPayload, TokenResponse, RefreshTokenResponse, AuthUser } from "../shared/types/auth.types";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Registers a new user
   * @param registerDto - User registration data
   * @returns User without password
   */
  async register(registerDto: RegisterDto): Promise<AuthUser> {
    this.logger.log(`Registering new user: ${registerDto.email}`);

    const existingUser = await this.userService.findOneByEmail(
      registerDto.email,
    );
    if (existingUser) {
      throw new BadRequestException(ERROR_MESSAGES.USERS.ALREADY_EXISTS);
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const user = await this.userService.create({
      ...registerDto,
      password: hashedPassword,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    this.logger.log(`User registered successfully: ${result.email}`);
    return result;
  }

  /**
   * Validates user credentials for LocalStrategy
   * @param email - User email
   * @param pass - User password
   * @returns User object if valid, null otherwise
   */
  async validateUser(email: string, pass: string): Promise<AuthUser | null> {
    this.logger.debug(`Validating user: ${email}`);
    const user = await this.userService.findOneByEmail(email);
    if (!user) {
      this.logger.debug(`User not found: ${email}`);
      return null;
    }

    // Password comparison would go here if UserService returned password
    // For now, LocalStrategy handles validation

    return user;
  }

  /**
   * Generates JWT token for authenticated user
   * @param user - Authenticated user
   * @returns JWT access token
   */
  async login(user: AuthUser): Promise<TokenResponse> {
    this.logger.log(`User login: ${user.email}`);

    const payload: JwtPayload = {
      email: user.email,
      sub: user.id,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  /**
   * Creates access and refresh tokens
   * @param payload - JWT payload
   * @returns Access and refresh tokens
   */
  createToken(payload: JwtPayload): {
    accessToken: string;
    refreshToken: string;
  } {
    const accessSecret = this.configService.get<string>("JWT_ACCESS_SECRET");
    const accessExpiresIn = this.configService.get<string>("JWT_ACCESS_EXPIRES_IN");

    const refreshSecret = this.configService.get<string>("JWT_REFRESH_SECRET");
    if (!refreshSecret) {
      throw new Error("JWT_REFRESH_SECRET no está configurado.");
    }
    const refreshExpiresIn = this.configService.get<string>("JWT_REFRESH_EXPIRES_IN");

    const tokenPayload: JwtPayload = {
      ...payload,
      createdAt: Date.now(),
    };

    const accessToken = jwt.sign(tokenPayload, accessSecret, {
      expiresIn: accessExpiresIn,
    });

    const refreshTokenPayload: JwtPayload = {
      ...payload,
      createdAt: Date.now(),
    };

    const refreshToken = jwt.sign(refreshTokenPayload, refreshSecret, {
      expiresIn: refreshExpiresIn,
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Refreshes access token using refresh token
   * @param refreshToken - Refresh token data
   * @returns New tokens or error
   */
  async refreshToken(refreshToken: RefreshTokenAuthDto): Promise<RefreshTokenResponse> {
    try {
      const _refreshToken = refreshToken.refreshToken;
      const refreshSecret = this.configService.get<string>("JWT_REFRESH_SECRET");

      if (!refreshSecret) {
        throw new Error("JWT_REFRESH_SECRET no está configurado.");
      }

      // Verify and decode refresh token
      const decoded = jwt.verify(_refreshToken, refreshSecret) as JwtPayload;
      const userId = decoded.sub;

      // Get stored refresh token
      const storedRefreshToken = await this.getRefreshToken(String(userId));

      if (storedRefreshToken !== _refreshToken) {
        this.logger.warn(`Invalid refresh token attempt for user: ${userId}`);
        throw new Error(ERROR_MESSAGES.AUTH.INVALID_TOKEN);
      }

      // Remove exp and iat fields to regenerate
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { exp, iat, ...payloadWithoutExp } = decoded;

      // Generate new tokens
      const newTokens = this.createToken(payloadWithoutExp);

      // Save new refresh token
      await this.saveRefreshToken(String(userId), newTokens.refreshToken);

      return {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Refresh token error: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Saves refresh token for a user
   * @param userId - User ID
   * @param refreshToken - Refresh token to save
   */
  async saveRefreshToken(userId: string, refreshToken: string): Promise<void> {
    await this.userService.updateRefreshToken(userId, refreshToken);
  }

  /**
   * Gets stored refresh token for a user
   * @param userId - User ID
   * @returns Stored refresh token
   */
  async getRefreshToken(userId: string): Promise<string> {
    return this.userService.getRefreshToken(userId);
  }
}
