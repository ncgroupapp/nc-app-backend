import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateManualDto {
  @ApiProperty({
    example: 'Manual de Usuario',
    description: 'The name of the manual',
  })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiProperty({
    example: 'https://firebasestorage.googleapis.com/v0/b/project.appspot.com/o/manuals%2Fuser-guide.pdf',
    description: 'The URL of the manual file stored in Firebase',
  })
  @IsNotEmpty()
  @IsString()
  fileUrl!: string;

  @ApiProperty({
    example: 'This manual describes how to use the system features.',
    description: 'A brief description of the manual',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}
