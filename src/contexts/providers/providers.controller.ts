import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  Query,
  Logger,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBody,
} from "@nestjs/swagger";
import { ProvidersService } from "./providers.service";
import { CreateProviderDto } from "./dto/create-provider.dto";
import { UpdateProviderDto } from "./dto/update-provider.dto";
import { Provider } from "./entities/provider.entity";
import { PaginationDto } from "../shared/dto/pagination.dto";
import { PaginatedResult } from "../shared/interfaces/paginated-result.interface";
import { TransformInterceptor } from "../shared/interceptors/transform.interceptor";

@ApiTags("providers")
@Controller("providers")
@UseInterceptors(TransformInterceptor)
export class ProvidersController {
  private readonly logger = new Logger(ProvidersController.name);

  constructor(private readonly providersService: ProvidersService) {}

  @Post()
  @ApiOperation({ summary: "Create a new provider" })
  @ApiResponse({
    status: 201,
    description: "Provider created successfully",
    type: Provider,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 409, description: "Provider with RUT already exists" })
  async create(@Body() createProviderDto: CreateProviderDto): Promise<Provider> {
    this.logger.log(
      `POST /providers - Creating provider with RUT: ${createProviderDto.rut}`,
    );
    return this.providersService.create(createProviderDto);
  }

  @Get()
  @ApiOperation({ summary: "Get all providers" })
  @ApiResponse({
    status: 200,
    description: "List of providers",
    type: [Provider],
  })
  @ApiQuery({
    name: "rut",
    required: false,
    description: "Filter by RUT",
    type: String,
  })
  @ApiQuery({
    name: "brand",
    required: false,
    description: "Filter by Brand",
    type: String,
  })
  async findAll(
    @Query() paginationDto: PaginationDto,
    @Query("rut") rut?: string,
    @Query("brand") brand?: string
  ): Promise<PaginatedResult<Provider> | Provider[]> {
    this.logger.debug(`GET /providers${rut ? `?rut=${rut}` : ""}${brand ? `?brand=${brand}` : ""}`);
    if (rut) {
      const provider = await this.providersService.findByRut(rut);
      return provider ? [provider] : [];
    }
    return this.providersService.findAll(paginationDto, { brand });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a provider by ID" })
  @ApiResponse({
    status: 200,
    description: "Provider found",
    type: Provider,
  })
  @ApiResponse({ status: 404, description: "Provider not found" })
  async findOne(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<Provider> {
    this.logger.debug(`GET /providers/${id}`);
    return this.providersService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a provider" })
  @ApiBody({
    type: UpdateProviderDto,
    examples: {
      basicUpdate: {
        summary: "Basic update (Name and Country)",
        value: {
          name: "Updated Provider Name",
          country: "Argentina",
        },
      },
      brandUpdate: {
        summary: "Update Brand (Use brand_id)",
        description: "Note: Use 'brand_id' to update the associated brand, not 'brandId'.",
        value: {
          brand_id: 5,
        },
      },
      contactsUpdate: {
        summary: "Update Contacts (Full replacement)",
        description: "When updating contacts, the entire list must be sent. Single contact updates are not supported.",
        value: {
          contacts: [
            {
              name: "New Contact Name",
              email: "new.contact@example.com",
              phone: "+598 99 123 456",
              address: "New Address 1234",
            },
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Provider updated successfully",
    type: Provider,
  })
  @ApiResponse({ status: 404, description: "Provider not found" })
  @ApiResponse({ status: 409, description: "Provider with RUT already exists" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateProviderDto: UpdateProviderDto,
  ): Promise<Provider> {
    this.logger.log(`PATCH /providers/${id} - Updating provider`);
    return this.providersService.update(id, updateProviderDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a provider" })
  @ApiResponse({
    status: 200,
    description: "Provider deleted successfully",
  })
  @ApiResponse({ status: 404, description: "Provider not found" })
  async remove(@Param("id", ParseIntPipe) id: number): Promise<void> {
    this.logger.log(`DELETE /providers/${id} - Deleting provider`);
    await this.providersService.remove(id);
  }
}

