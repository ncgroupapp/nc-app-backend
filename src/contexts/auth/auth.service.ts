import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from '../users/user.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ConfigService } from "@nestjs/config";
import jwt from "jsonwebtoken";
import { RefreshTokenAuthDto } from './dto/refresh-token-auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const existingUser = await this.userService.findOneByEmail(
      registerDto.email,
    );
    if (existingUser) {
      throw new BadRequestException("User already exists");
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const user = await this.userService.create({
      ...registerDto,
      password: hashedPassword,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    return result;
  }

  async validateUser(email: string, pass: string): Promise<any> {
    console.log(`Validating user: ${email}`);
    const user = await this.userService.findOneByEmail(email);
    if (!user) {
      console.log(`User not found: ${email}`);
      return null;
    }
    
    return user;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  createToken(payload: any) {
    //género el accessToken y el refreshToken con los secrets del .env
    const accessSecret = this.configService.get("JWT_ACCESS_SECRET");
    const accessExpiresIn = this.configService.get("JWT_ACCESS_EXPIRES_IN");

    const refreshSecret = this.configService.get<string>("JWT_REFRESH_SECRET");
    if (!refreshSecret) {
      throw new Error("JWT_REFRESH_SECRET no está configurado.");
    }
    const refreshExpiresIn = this.configService.get("JWT_REFRESH_EXPIRES_IN");

    const tokenPayload = {
      ...payload,
      createdAt: Date.now(),
    };

    const accessToken = jwt.sign(tokenPayload, accessSecret, {
      expiresIn: accessExpiresIn,
    });

    const refreshTokenPayload = {
      ...payload,
      createdAt: Date.now(),
    };

    const refreshToken = jwt.sign(refreshTokenPayload, refreshSecret, {
      expiresIn: refreshExpiresIn,
    });

    return {
      accessToken: accessToken,
      refreshToken: refreshToken,
    };
  }

  async refreshToken(refreshToken: RefreshTokenAuthDto) {
    try {
      const _refreshToken = refreshToken.refreshToken;
      const refreshSecret =
        this.configService.get<string>("JWT_REFRESH_SECRET");

      if (!refreshSecret) {
        throw new Error("JWT_REFRESH_SECRET no está configurado.");
      }

      //verifico y decodifico el refresh token
      const decoded = jwt.verify(
        _refreshToken,
        refreshSecret,
      ) as jwt.JwtPayload;
      const userId = decoded._id;

      //obtengo el refresh token almacenado del usuario
      const storedRefreshToken =
        await this.getRefreshToken(userId);

      if (storedRefreshToken !== _refreshToken) {
        throw new Error("Token de actualización inválido");
      }

      // elimino los campos exp e iat para que se generen de nuevo a lo que no uso las variables tengo que comentarlas con eslint
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { exp, iat, ...payloadWithoutExp } = decoded;

      // Genero nuevos tokens
      const newTokens = this.createToken(payloadWithoutExp);

      //guardo el nuevo refresh token
      await this.saveRefreshToken(
        userId,
        newTokens.refreshToken,
      );

      return {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async saveRefreshToken(userId: string, refreshToken: string): Promise<void> {
    await this.userService.updateRefreshToken(userId, refreshToken);
  }

  async getRefreshToken(userId: string): Promise<string> {
    return this.userService.getRefreshToken(userId);
  }
}
