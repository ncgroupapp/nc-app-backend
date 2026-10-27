import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { FastifyReply } from "fastify";

/**
 * PostgreSQL error structure with detail property
 */
interface PostgresError extends Error {
  detail?: string;
  code?: string;
}

/**
 * HTTP error response structure
 */
interface ErrorResponse {
  success: boolean;
  data: string | Record<string, unknown>;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    // Determine status code
    let status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Determine error message
    let message =
      exception instanceof HttpException
        ? exception.getResponse()
        : (exception instanceof Error ? exception.message : "Internal server error");

    // Flatten error message if it's an object (common in NestJS/class-validator)
    if (typeof message === "object" && message !== null) {
      const responseObj = message as any;
      if (Array.isArray(responseObj.message)) {
        message = responseObj.message.join(", ");
      } else if (typeof responseObj.message === "string") {
        message = responseObj.message;
      } else if (responseObj.error && typeof responseObj.error === "string") {
        message = responseObj.error;
      } else {
        message = JSON.stringify(message);
      }
    }

    // Handle PostgreSQL unique constraint violations
    if (this.isPostgresError(exception)) {
      if (exception.detail && exception.detail.includes("already exists")) {
        const match = exception.detail.match(
          /Key \((.+)\)=\((.+)\) already exists/,
        );

        if (match) {
          status = HttpStatus.CONFLICT;
          const field = match[1];
          const value = match[2];

          if (field === "code" || field === "sku" || field === "rut") {
            message = `El ${field === 'rut' ? 'RUT' : field === 'sku' ? 'SKU' : 'código'} '${value}' ya existe`;
          } else {
            message = `Ya existe un registro con el valor '${value}' en el campo '${field}'`;
          }
        }
      }
    }

    // Log the exception
    this.logger.error(
      `HTTP Status: ${status} Error Message: ${JSON.stringify(message)}`,
    );

    // Send response
    const responseBody: ErrorResponse = {
      success: false,
      data: message as string,
    };

    // Errors thrown from middleware get the raw Node response, not a Fastify reply
    if (typeof response.code === "function") {
      await response.code(status).send(responseBody);
      return;
    }
    const raw = response as unknown as import("http").ServerResponse;
    if (!raw.headersSent) {
      raw.statusCode = status;
      raw.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    raw.end(JSON.stringify(responseBody));
  }

  /**
   * Type guard to check if error is a PostgreSQL error
   */
  private isPostgresError(error: unknown): error is PostgresError {
    return (
      error instanceof Error &&
      "detail" in error &&
      typeof error.detail === "string"
    );
  }
}
