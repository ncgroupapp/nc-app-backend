import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MailAccount } from "./entities/mail-account.entity";
import { Solicitud } from "./entities/solicitud.entity";
import { SolicitudMessage } from "./entities/solicitud-message.entity";
import { SolicitudAttachment } from "./entities/solicitud-attachment.entity";
import { MailSyncService } from "./mail-sync.service";
import { SolicitudesController } from "./solicitudes.controller";
import { SolicitudesService } from "./solicitudes.service";

@Module({
  imports: [TypeOrmModule.forFeature([MailAccount, Solicitud, SolicitudMessage, SolicitudAttachment])],
  controllers: [SolicitudesController],
  providers: [SolicitudesService, MailSyncService],
})
export class SolicitudesModule {}
