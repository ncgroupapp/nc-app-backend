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
import { OffersService } from "./offers.service";
import { CreateOfferDto } from "./dto/create-offer.dto";
import { UpdateOfferDto } from "./dto/update-offer.dto";
import { Offer } from "./entities/offer.entity";

@ApiTags("offers")
@Controller("offers")
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Post()
  @ApiOperation({ summary: "Create a new offer" })
  @ApiResponse({
    status: 201,
    description: "Offer created successfully",
    type: Offer,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 404, description: "Product or Provider not found" })
  async create(@Body() createOfferDto: CreateOfferDto): Promise<Offer> {
    return this.offersService.create(createOfferDto);
  }

  @Get()
  @ApiOperation({ summary: "Get all offers" })
  @ApiResponse({
    status: 200,
    description: "List of offers",
    type: [Offer],
  })
  @ApiQuery({
    name: "productId",
    required: false,
    description: "Filter by product ID",
    type: Number,
  })
  async findAll(
    @Query("productId") productId?: string,
  ): Promise<Offer[]> {
    const productIdNum = productId
      ? parseInt(productId, 10)
      : undefined;
    return this.offersService.findAll(productIdNum);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get an offer by ID" })
  @ApiResponse({
    status: 200,
    description: "Offer found",
    type: Offer,
  })
  @ApiResponse({ status: 404, description: "Offer not found" })
  async findOne(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<Offer> {
    const offer = await this.offersService.findOne(id);
    if (!offer) {
      throw new NotFoundException(`Offer with ID ${id} not found`);
    }
    return offer;
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update an offer" })
  @ApiResponse({
    status: 200,
    description: "Offer updated successfully",
    type: Offer,
  })
  @ApiResponse({ status: 404, description: "Offer not found" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateOfferDto: UpdateOfferDto,
  ): Promise<Offer> {
    return this.offersService.update(id, updateOfferDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete an offer" })
  @ApiResponse({
    status: 204,
    description: "Offer deleted successfully",
  })
  @ApiResponse({ status: 404, description: "Offer not found" })
  async remove(@Param("id", ParseIntPipe) id: number): Promise<void> {
    await this.offersService.remove(id);
  }
}

