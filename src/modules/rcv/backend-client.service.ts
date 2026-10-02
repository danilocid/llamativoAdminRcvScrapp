import {
  BadGatewayException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { PurchaseApiData } from './dto/purchases-api.interface';

/**
 * Cliente HTTP del backend de Llamativo (el servicio que tiene la BD).
 *
 * Autenticación: JWT obtenido vía `POST {BACKEND_URL}/auth/login`
 * (ver `AuthService.getToken()`), con reintento automático una vez si el
 * backend responde 401 (token vencido).
 */
@Injectable()
export class BackendClientService {
  private readonly logger = new Logger(BackendClientService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly authService: AuthService,
  ) {}

  private getBackendUrl(): string {
    const url = process.env.BACKEND_URL;
    if (!url) {
      throw new BadGatewayException(
        'BACKEND_URL no está configurada en las variables de entorno',
      );
    }
    return url.replace(/\/+$/, '');
  }

  /**
   * Envía los registros extraídos del RCV al backend para su persistencia.
   * Contrato: `POST /purchases/import` con body
   * `{ mes, anio, registros: PurchaseApiData[] }`.
   */
  async sendPurchases(
    mes: number,
    anio: number,
    registros: PurchaseApiData[],
  ): Promise<any> {
    const url = `${this.getBackendUrl()}/purchases/import`;
    const body = { mes, anio, registros };

    let token = await this.authService.getToken();

    try {
      return await this.post(url, body, token);
    } catch (error: any) {
      if (error?.response?.status !== 401) {
        throw this.toHttpError(error, url);
      }

      // Token vencido o rechazado: uno solo de reintentos.
      this.logger.warn('El backend respondió 401, renovando token y reintentando');
      this.authService.invalidateToken();
      token = await this.authService.getToken();

      try {
        return await this.post(url, body, token);
      } catch (retryError: any) {
        throw this.toHttpError(retryError, url);
      }
    }
  }

  private async post(url: string, body: any, token: string) {
    const response = await firstValueFrom(
      this.httpService.post(url, body, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 120000,
      }),
    );
    return response.data;
  }

  private toHttpError(error: any, url: string): Error {
    const backendMessage =
      error?.response?.data?.serverResponseMessage ||
      error?.response?.data?.message ||
      error?.message;

    this.logger.error(
      `Error enviando registros al backend (${url}): ${backendMessage}`,
    );

    return new BadGatewayException(
      `No se pudieron enviar los registros al backend: ${backendMessage}`,
    );
  }
}
