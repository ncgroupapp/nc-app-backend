import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { FastifyRequest, FastifyReply } from "fastify";
import { IncomingMessage, ServerResponse } from "http";

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HTTP");

  use(
    req: FastifyRequest,
    res: FastifyReply | ServerResponse,
    next: () => void
  ) {
    const { method, url } = req;
    const userAgent = req.headers["user-agent"] || "";

    // Type guard to check if response is FastifyReply
    const isFastifyReply = (response: unknown): response is FastifyReply => {
      return typeof response === "object" && response !== null && "code" in response;
    };

    if (isFastifyReply(res)) {
      res.on("finish", () => {
        const statusCode = res.statusCode;
        const contentLength = res.getHeader("content-length");
        this.logger.log(
          `Request: [${method}] ${url} | Status: [${statusCode}] | Content-Length: [${contentLength || "N/A"}] | User-Agent: [${userAgent}]`,
        );
      });
    } else {
      // Fallback for raw ServerResponse
      const standardRes = res as ServerResponse;
      standardRes.on("finish", () => {
        const statusCode = standardRes.statusCode;
        this.logger.log(
          `Request: [${method}] ${url} | Status: [${statusCode}] | User-Agent: [${userAgent}]`,
        );
      });
    }

    next();
  }
}
