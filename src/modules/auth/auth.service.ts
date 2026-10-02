import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { LoginAuthDto } from './dto/login.dto';
import { ResponseDto } from 'src/common/dto/response.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /** El JWT del backend vive 72h; lo reutilizamos por 1 hora. */
  private static readonly TOKEN_TTL_MS = 60 * 60 * 1000;

  private cachedToken: string | null = null;
  private cachedAt = 0;

  constructor(private readonly httpService: HttpService) {}

  private getBackendUrl(): string {
    const url = process.env.BACKEND_URL;
    if (!url) {
      throw new InternalServerErrorException(
        'BACKEND_URL no está configurada en las variables de entorno',
      );
    }
    return url.replace(/\/+$/, '');
  }

  /**
   * Envía una petición POST al login del backend y devuelve su respuesta
   * completa: `{ serverResponseCode, serverResponseMessage, data: <JWT> }`.
   *
   * Si no se envían credenciales se usan BACKEND_USER / BACKEND_PASSWORD.
   */
  async login(dto: LoginAuthDto = {}): Promise<ResponseDto> {
    const user = dto.user || process.env.BACKEND_USER;
    const password = dto.password || process.env.BACKEND_PASSWORD;

    if (!user || !password) {
      throw new BadRequestException(
        'Faltan credenciales: envíe user y password, o defina BACKEND_USER y BACKEND_PASSWORD',
      );
    }

    const url = `${this.getBackendUrl()}/auth/login`;

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, { user, password }),
      );

      const body = response.data;
      if (body?.serverResponseCode !== 200) {
        throw new UnauthorizedException(
          body?.serverResponseMessage || 'El backend rechazó las credenciales',
        );
      }

      this.logger.log(`Login exitoso contra el backend (${url})`);
      return body;
    } catch (error: any) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      const backendMessage =
        error?.response?.data?.serverResponseMessage ||
        error?.response?.data?.message ||
        error?.message;

      if (error?.response?.status === 401) {
        throw new UnauthorizedException(
          backendMessage || 'Credenciales inválidas en el backend',
        );
      }

      this.logger.error(`No se pudo contactar al backend: ${backendMessage}`);
      throw new BadGatewayException(
        `No se pudo contactar el backend en ${url}: ${backendMessage}`,
      );
    }
  }

  /** Devuelve un JWT válido para llamar al backend, reutilizando la caché. */
  async getToken(): Promise<string> {
    const isFresh =
      this.cachedToken &&
      Date.now() - this.cachedAt < AuthService.TOKEN_TTL_MS;

    if (!isFresh) {
      const response = await this.login();
      this.cachedToken = response.data;
      this.cachedAt = Date.now();
    }

    return this.cachedToken;
  }

  /** Invalida el token cacheado (p. ej. tras un 401 del backend). */
  invalidateToken(): void {
    this.cachedToken = null;
    this.cachedAt = 0;
  }
}
