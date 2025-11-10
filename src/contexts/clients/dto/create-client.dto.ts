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
    example: "12345678-6",
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
        phone: "+598 99 123 456",
        address: "Av. 18 de Julio 1234, Montevideo",
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

