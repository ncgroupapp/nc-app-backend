import { IsNotEmpty, IsString } from "class-validator";

export class RefreshTokenAuthDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
