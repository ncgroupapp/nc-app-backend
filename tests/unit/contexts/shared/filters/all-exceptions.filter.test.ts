import { ArgumentsHost, HttpException, HttpStatus } from "@nestjs/common";
import { AllExceptionsFilter } from "../../../../../src/contexts/shared/filters/all-exceptions.filter";
import { createMock, Mock } from "../../../../utils/mock";
import { FastifyReply } from "fastify";
import { describe, it, expect, beforeEach } from "vitest";

describe("AllExceptionsFilter", () => {
  let filter: AllExceptionsFilter;
  let mockArgumentsHost: Mock<ArgumentsHost>;
  let mockResponse: Mock<FastifyReply>;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    mockResponse = createMock<FastifyReply>();
    mockResponse.code.mockReturnValue(mockResponse);
    mockResponse.send.mockReturnValue(mockResponse);

    mockArgumentsHost = createMock<ArgumentsHost>();
    mockArgumentsHost.switchToHttp.mockReturnValue({
      getResponse: () => mockResponse,
      getRequest: () => ({}),
    } as any);
  });

  it("should format regular HttpException", async () => {
    const exception = new HttpException("Custom error", HttpStatus.BAD_REQUEST);
    await filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.code).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.send).toHaveBeenCalledWith({
      success: false,
      data: "Custom error",
    });
  });

  it("should format validation errors (array of messages)", async () => {
    const validationErrors = {
      message: ["name must be a string", "code is required"],
      error: "Bad Request",
      statusCode: 400,
    };
    const exception = new HttpException(validationErrors, HttpStatus.BAD_REQUEST);
    await filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.code).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    // This is the expected behavior after fix
    expect(mockResponse.send).toHaveBeenCalledWith({
      success: false,
      data: "name must be a string, code is required",
    });
  });

  it("should format generic Error", async () => {
    const exception = new Error("Something went wrong");
    await filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.code).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.send).toHaveBeenCalledWith({
      success: false,
      data: "Something went wrong",
    });
  });
});
