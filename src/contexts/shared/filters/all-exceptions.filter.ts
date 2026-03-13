import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { FastifyReply } from "fastify";

@Catch() // Captura todas las excepciones
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  async catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response: any = ctx.getResponse<FastifyReply>(); // Obtén el objeto FastifyReply pero lo declaro como any ya que no reconoce los metodos

    // Determina el estado de la excepción
    let status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message =
      exception instanceof HttpException
        ? exception.getResponse()
        : (exception.message ?? "Internal server error");

    // Postgres unique violation error (based on detail message)
    if (
      exception?.detail &&
      typeof exception.detail === "string" &&
      exception.detail.includes("already exists")
    ) {
      const match = exception.detail.match(
        /Key \((.+)\)=\((.+)\) already exists/,
      );

      if (match) {
        status = HttpStatus.CONFLICT;
        const field = match[1];
        const value = match[2];

        if (field === "code") {
          message = `El código '${value}' ya existe`;
        } else {
          message = `Ya existe un registro con el valor '${value}' en el campo '${field}'`;
        }
      }
    }

    // Log de la excepción
    this.logger.error(
      `HTTP Status: ${status} Error Message: ${JSON.stringify(message)}`,
    );

    if (response.code) {
      await response.code(status).send({
        success: false,
        data: message,
      });
    } else {
      response.writeHead(status, { "Content-Type": "application/json" });
      await response.end(
        JSON.stringify({
          success: false,
          data: message,
        }),
      );
    }
  }
}
