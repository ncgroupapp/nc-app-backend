import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JwtPayload, AuthUser } from '../../shared/types/auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>("JWT_ACCESS_SECRET") ||
        configService.get<string>("JWT_SECRET") ||
        "secretKey",
    });
  }

  /**
   * Validates JWT payload and returns user object
   * @param payload - Decoded JWT payload
   * @returns User object for attachment to request
   */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
