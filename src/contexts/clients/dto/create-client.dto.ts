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

export class CreateClientDto {
  @ApiProperty({
    description: "Client name",
    example: "Empresa ABC S.A.",
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: "Client identifier/RUT",
    example: "12.345.678-9",
  })
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @ApiProperty({
    description: "Client contacts",
    type: [ContactDto],
    example: [
      {
        name: "María González",
        email: "maria@example.com",
        phone: "+56 9 9876 5432",
        address: "Av. Empresa 456, Santiago",
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

