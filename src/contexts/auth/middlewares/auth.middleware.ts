import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  use(req: FastifyRequest, res: FastifyReply, next: () => void) {
    try {
      if (req.method === "OPTIONS") {
        // Ignora las solicitudes OPTIONS y sigue ya que hace 2 peticiones por req y en options el auth no viaja
        return next();
      }

      const authHeader = req.headers["authorization"];
      if (!authHeader) {
        throw new UnauthorizedException(
          "Encabezado de autorización no encontrado",
        );
      }

      const token = authHeader.split(" ")[1];
      if (!token) {
        throw new UnauthorizedException("Token no encontrado");
      }

      const secret =
        this.configService.get<string>("JWT_ACCESS_SECRET") ||
        this.configService.get<string>("JWT_SECRET") ||
        "secretKey";

      const decoded = jwt.verify(token, secret);

      if (!decoded) {
        throw new UnauthorizedException("Token inválido");
      }

      next();
    } catch (e: any) {
      throw new UnauthorizedException(
        "Token inválido o expirado: " + e.message,
      );
    }
  }
}
