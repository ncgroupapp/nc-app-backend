import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "../../shared/types/auth.types";

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuthMiddleware.name);

  constructor(private readonly configService: ConfigService) {}

  use(req: FastifyRequest, res: FastifyReply, next: () => void): void {
    try {
      // Allow OPTIONS requests (CORS preflight)
      if (req.method === "OPTIONS") {
        return next();
      }

      const authHeader = req.headers["authorization"];
      if (!authHeader) {
        this.logger.warn('Authorization header not found');
        throw new UnauthorizedException(
          "Encabezado de autorización no encontrado",
        );
      }

      const token = authHeader.split(" ")[1];
      if (!token) {
        this.logger.warn('Token not found in authorization header');
        throw new UnauthorizedException("Token no encontrado");
      }

      const secret =
        this.configService.get<string>("JWT_ACCESS_SECRET") ||
        this.configService.get<string>("JWT_SECRET") ||
        "secretKey";

      const decoded = jwt.verify(token, secret) as JwtPayload;

      if (!decoded) {
        this.logger.warn('Invalid token');
        throw new UnauthorizedException("Token inválido");
      }

      // Attach user info to request
      (req as FastifyRequest & { user: JwtPayload }).user = decoded;

      next();
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "Unknown error";
      this.logger.error(`Auth middleware error: ${errorMessage}`);
      throw new UnauthorizedException(
        "Token inválido o expirado: " + errorMessage,
      );
    }
  }
}
