import { PartialType } from '@nestjs/swagger';
import { CreateManualDto } from './create-manual.dto';

export class UpdateManualDto extends PartialType(CreateManualDto) {}
