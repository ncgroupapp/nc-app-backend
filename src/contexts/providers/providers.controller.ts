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
  NotFoundException,
  Query,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from "@nestjs/swagger";
import { ProvidersService } from "./providers.service";
import { CreateProviderDto } from "./dto/create-provider.dto";
import { UpdateProviderDto } from "./dto/update-provider.dto";
import { Provider } from "./entities/provider.entity";

@ApiTags("providers")
@Controller("providers")
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Post()
  @ApiOperation({ summary: "Create a new provider" })
  @ApiResponse({
    status: 201,
    description: "Provider created successfully",
    type: Provider,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  async create(@Body() createProviderDto: CreateProviderDto): Promise<Provider> {
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
  async findAll(@Query("rut") rut?: string): Promise<Provider[]> {
    if (rut) {
      const provider = await this.providersService.findByRut(rut);
      return provider ? [provider] : [];
    }
    return this.providersService.findAll();
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
    const provider = await this.providersService.findOne(id);
    if (!provider) {
      throw new NotFoundException(`Provider with ID ${id} not found`);
    }
    return provider;
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a provider" })
  @ApiResponse({
    status: 200,
    description: "Provider updated successfully",
    type: Provider,
  })
  @ApiResponse({ status: 404, description: "Provider not found" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateProviderDto: UpdateProviderDto,
  ): Promise<Provider> {
    return this.providersService.update(id, updateProviderDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a provider" })
  @ApiResponse({
    status: 204,
    description: "Provider deleted successfully",
  })
  @ApiResponse({ status: 404, description: "Provider not found" })
  async remove(@Param("id", ParseIntPipe) id: number): Promise<void> {
    await this.providersService.remove(id);
  }
}

