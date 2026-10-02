import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RcvAuthGuard } from 'src/common/guards/rcv-auth.guard';
import { RcvService } from './rcv.service';
import { SyncQueryDto } from './dto/sync-query.dto';
import { ResponseDto } from 'src/common/dto/response.dto';

@Controller('rcv')
@ApiTags('RCV')
export class RcvController {
  constructor(private readonly rcvService: RcvService) {}

  /**
   * Ejecuta el scraping del RCV del SII y envía los registros al backend
   * para su persistencia. Puede tardar varios minutos (scraping real).
   * Endpoint sin autenticación: el servicio hace login en el backend por su cuenta.
   */
  @Get('sincronizar')
  @ApiOperation({
    summary: 'Scraping del RCV + envío al backend',
    description:
      'Extrae las compras del período indicado desde el SII y las envía a POST {BACKEND_URL}/purchases/import. No requiere autenticación: internamente el servicio obtiene un JWT con POST {BACKEND_URL}/auth/login (env BACKEND_USER / BACKEND_PASSWORD).',
  })
  @ApiQuery({
    name: 'mes',
    required: false,
    type: Number,
    description: 'Mes a sincronizar (1-12). Default: mes actual',
  })
  @ApiQuery({
    name: 'anio',
    required: false,
    type: Number,
    description: 'Año a sincronizar. Default: año actual',
  })
  async sincronizar(@Query() t: SyncQueryDto): Promise<ResponseDto> {
    const now = new Date();
    const mes = t.mes || now.getMonth() + 1;
    const anio = t.anio || now.getFullYear();

    return await this.rcvService.sync(mes, anio);
  }

  /**
   * Ejecuta el scraping y devuelve los registros crudos en JSON sin
   * enviarlos al backend (no modifica la base de datos).
   * Requiere autenticación (JWT o x-api-key).
   */
  @Get('preview')
  @ApiBearerAuth('jwt')
  @UseGuards(RcvAuthGuard)
  @ApiOperation({
    summary: 'Scraping del RCV sin persistir',
    description:
      'Devuelve los registros crudos del período indicado. No envía nada al backend.',
  })
  @ApiQuery({
    name: 'mes',
    required: false,
    type: Number,
    description: 'Mes a consultar (1-12). Default: mes actual',
  })
  @ApiQuery({
    name: 'anio',
    required: false,
    type: Number,
    description: 'Año a consultar. Default: año actual',
  })
  async preview(@Query() t: SyncQueryDto): Promise<ResponseDto> {
    const now = new Date();
    const mes = t.mes || now.getMonth() + 1;
    const anio = t.anio || now.getFullYear();

    return await this.rcvService.preview(mes, anio);
  }
}
