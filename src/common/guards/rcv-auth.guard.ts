import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard de los endpoints del scraper.
 *
 * Acepta dos mecanismos (el primero que coincida gana):
 *  1. Header `x-api-key` con el valor de la variable de entorno `API_KEY`
 *     (solo si `API_KEY` está definida) — pensado para llamadas
 *     servidor-a-servicio sin hacer login.
 *  2. Header `Authorization: Bearer <JWT>` — cualquier JWT emitido por el
 *     backend (`POST {BACKEND_URL}/auth/login`), verificado con el
 *     `JWT_SECRET` compartido entre ambos servicios.
 */
@Injectable()
export class RcvAuthGuard extends AuthGuard('jwt') {
  canActivate(context) {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (
      apiKey &&
      process.env.API_KEY &&
      String(apiKey) === process.env.API_KEY
    ) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err, user) {
    if (err || !user) {
      throw (
        err ||
        new UnauthorizedException(
          'Token inválido o ausente. Envíe Authorization: Bearer <JWT> (obtenido en POST /auth/login) o el header x-api-key.',
        )
      );
    }
    return user;
  }
}
