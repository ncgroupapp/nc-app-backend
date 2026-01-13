import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { FastifyRequest } from "fastify";

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HTTP");

  use(req: FastifyRequest, res: any, next: () => void) {
    const { method, url } = req;
    const userAgent = req.headers["user-agent"] || ""; // Fastify maneja headers como un objeto

    res.on("finish", () => {
      const statusCode = res.statusCode;
      const contentLength = res.getHeader("content-length"); // Obtén el header con getHeader en lugar de get
      this.logger.log(
        `Request: [${method}] ${url} | Status: [${statusCode}] | Content-Length: [${contentLength || "N/A"}] | User-Agent: [${userAgent}]`,
      );
    });

    next();
  }
}
