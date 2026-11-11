import { PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class SaveCollectionDto {
  /** Date the transfer was received */
  @IsDateString()
  date!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amountReceived!: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  bank?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string | null;

  /** Cost of the goods, without VAT, in the collection currency */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cost?: number;

  /** VAT paid to the providers for those goods */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  purchaseTax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  licitationId?: number | null;

  @IsOptional()
  @IsString()
  notes?: string | null;

  /** Invoices the transfer pays; all of the same client and currency */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsInt({ each: true })
  invoiceIds!: number[];
}

export class UpdateCollectionDto extends PartialType(SaveCollectionDto) {}

export class PendingInvoicesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  clientId?: number;

  /** When editing: also list the invoices this collection already pays */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  collectionId?: number;
}
