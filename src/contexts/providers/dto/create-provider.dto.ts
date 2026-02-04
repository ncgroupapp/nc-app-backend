import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsEmail,
  IsOptional,
  ArrayMinSize,
  IsNumber,
} from "class-validator";
import { Type } from "class-transformer";
import { IsUruguayRut } from "@/contexts/shared/validators/is-uruguay-rut.validator";

export class ContactDto {
  @ApiProperty({ description: "Contact name", example: "Juan Pérez" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: "Contact email", example: "juan@example.com" })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description: "Contact phone",
    example: "+598 99 123 456",
    required: false,
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({
    description: "Contact address",
    example: "Av. 18 de Julio 1234, Montevideo",
    required: false,
  })
  @IsString()
  @IsOptional()
  address?: string;
}

export class CreateProviderDto {
  @ApiProperty({
    description: "Provider RUT (Uruguayan format: XXXXXXXX-X)",
    example: "12345678-6",
  })
  @IsString()
  @IsNotEmpty()
  @IsUruguayRut({ message: "RUT must be a valid Uruguayan RUT format (XXXXXXXX-X) with valid check digit" })
  rut!: string;

  @ApiProperty({
    description: "Provider name",
    example: "Proveedores ACME S.A.",
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: "Provider country",
    example: "Uruguay",
  })
  @IsString()
  @IsNotEmpty()
  country!: string;

  @ApiProperty({
    description: "Provider brand ID",
    example: 1,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  brand_id?: number;

  @ApiProperty({
    description: "Provider contacts",
    type: [ContactDto],
    example: [
      {
        name: "Juan Pérez",
        email: "juan@example.com",
        phone: "+56 9 1234 5678",
        address: "Av. Principal 123",
      },
    ],
  })
  @IsArray({ message: "Contacts must be an array" })
  @IsNotEmpty({ message: "Contacts array cannot be empty" })
  @ArrayMinSize(1, { message: "At least one contact is required" })
  @ValidateNested({ each: true })
  @Type(() => ContactDto)
  contacts!: ContactDto[];
}

