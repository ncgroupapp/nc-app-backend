import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsPositive, Max, Min } from "class-validator";

export class UpdateProfitabilitySettingsDto {
  @ApiProperty({ description: "Pesos uruguayos por 1 dólar", example: 40.5 })
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  exchangeRate!: number;

  @ApiProperty({ description: "Margen mínimo (%): por debajo se marca en rojo", example: 5 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  minMargin!: number;
}
