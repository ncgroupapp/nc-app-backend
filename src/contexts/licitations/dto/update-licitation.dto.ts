import { PartialType } from "@nestjs/swagger";
import { CreateLicitationDto } from "./create-licitation.dto";

export class UpdateLicitationDto extends PartialType(CreateLicitationDto) {}

