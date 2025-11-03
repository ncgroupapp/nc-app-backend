import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsEmail,
  IsOptional,
  ArrayMinSize,
} from "class-validator";
import { Type } from "class-transformer";

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
    example: "+56 9 1234 5678",
    required: false,
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({
    description: "Contact address",
    example: "Av. Principal 123, Santiago",
    required: false,
  })
  @IsString()
  @IsOptional()
  address?: string;
}

export class CreateProviderDto {
  @ApiProperty({
    description: "Provider RUT",
    example: "12.345.678-9",
  })
  @IsString()
  @IsNotEmpty()
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
    example: "Chile",
  })
  @IsString()
  @IsNotEmpty()
  country!: string;

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

