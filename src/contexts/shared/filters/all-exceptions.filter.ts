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

    await response.code(status).send(responseBody);
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
