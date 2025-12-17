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
  Logger,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
} from "@nestjs/swagger";
import { LicitationsService } from "./licitations.service";
import { CreateLicitationDto } from "./dto/create-licitation.dto";
import { UpdateLicitationDto } from "./dto/update-licitation.dto";
import { Licitation } from "./entities/licitation.entity";

@ApiTags("licitations")
@Controller("licitations")
export class LicitationsController {
  private readonly logger = new Logger(LicitationsController.name);

  constructor(private readonly licitationsService: LicitationsService) {}

  @Post()
  @ApiOperation({ summary: "Create a new licitation" })
  @ApiResponse({
    status: 201,
    description: "Licitation created successfully",
    type: Licitation,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 404, description: "Client or products not found" })
  async create(
    @Body() createLicitationDto: CreateLicitationDto,
  ): Promise<Licitation> {
    this.logger.log(`POST /licitations - Creating licitation with call number: ${createLicitationDto.callNumber}`);
    return this.licitationsService.create(createLicitationDto);
  }

  @Get()
  @ApiOperation({ summary: "Get all licitations" })
  @ApiResponse({
    status: 200,
    description: "List of licitations",
    type: [Licitation],
  })
  async findAll(): Promise<Licitation[]> {
    this.logger.debug("GET /licitations");
    return this.licitationsService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a licitation by ID" })
  @ApiResponse({
    status: 200,
    description: "Licitation found",
    type: Licitation,
  })
  @ApiResponse({ status: 404, description: "Licitation not found" })
  async findOne(@Param("id", ParseIntPipe) id: number): Promise<Licitation> {
    this.logger.debug(`GET /licitations/${id}`);
    return this.licitationsService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a licitation" })
  @ApiResponse({
    status: 200,
    description: "Licitation updated successfully",
    type: Licitation,
  })
  @ApiResponse({ status: 404, description: "Licitation not found" })
  @ApiResponse({ status: 400, description: "Bad request" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateLicitationDto: UpdateLicitationDto,
  ): Promise<Licitation> {
    this.logger.log(`PATCH /licitations/${id} - Updating licitation`);
    return this.licitationsService.update(id, updateLicitationDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a licitation" })
  @ApiResponse({
    status: 200,
    description: "Licitation deleted successfully",
  })
  @ApiResponse({ status: 404, description: "Licitation not found" })
  async remove(@Param("id", ParseIntPipe) id: number): Promise<void> {
    this.logger.log(`DELETE /licitations/${id} - Deleting licitation`);
    await this.licitationsService.remove(id);
  }
}

