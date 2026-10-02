import {
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ResponseDto } from 'src/common/dto/response.dto';
import { SiiScraperService } from './sii-scraper.service';
import { BackendClientService } from './backend-client.service';
import { PurchaseApiData } from './dto/purchases-api.interface';

@Injectable()
export class RcvService {
  private readonly logger = new Logger(RcvService.name);
  private running = false;

  constructor(
    private readonly siiScraperService: SiiScraperService,
    private readonly backendClientService: BackendClientService,
  ) {}

  /**
   * Flujo completo: scraping del RCV + envío de los registros al backend
   * (`POST /purchases/import`), quien los persiste en la base de datos.
   */
  async sync(mes: number, anio: number): Promise<ResponseDto> {
    if (this.running) {
      throw new ConflictException(
        'Ya hay una sincronización del RCV en curso, intente más tarde',
      );
    }

    this.running = true;
    this.logger.log(`Sincronización RCV iniciada para ${mes}/${anio}`);

    try {
      const registros = await this.siiScraperService.scrapePurchases(
        mes,
        anio,
      );

      this.logger.log(
        `${registros.length} registros extraídos, enviándolos al backend`,
      );

      const resultado = await this.backendClientService.sendPurchases(
        mes,
        anio,
        registros,
      );

      this.logger.log(`Sincronización RCV completada para ${mes}/${anio}`);

      return {
        serverResponseCode: 200,
        serverResponseMessage: 'Sincronización del RCV completada',
        data: {
          mes,
          anio,
          registrosExtraidos: registros.length,
          backend: resultado?.data ?? resultado,
        },
      };
    } catch (error) {
      const message = (error as Error).message;
      this.logger.error(`Error en sincronización RCV: ${message}`);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Fallo la sincronización del RCV: ${message}`,
      );
    } finally {
      this.running = false;
    }
  }

  /** Scraping sin enviar nada al backend. Sirve para inspeccionar datos. */
  async preview(mes: number, anio: number): Promise<ResponseDto> {
    this.logger.log(`Preview RCV solicitado para ${mes}/${anio}`);

    try {
      const registros: PurchaseApiData[] =
        await this.siiScraperService.scrapePurchases(mes, anio);

      return {
        serverResponseCode: 200,
        serverResponseMessage: 'Preview del RCV generado (no se envió al backend)',
        data: {
          mes,
          anio,
          registrosExtraidos: registros.length,
          registros,
        },
      };
    } catch (error) {
      const message = (error as Error).message;
      this.logger.error(`Error en preview RCV: ${message}`);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Fallo el preview del RCV: ${message}`,
      );
    }
  }
}
