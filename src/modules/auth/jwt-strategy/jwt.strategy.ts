import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

/**
 * Estrategia JWT idéntica a la del backend de Llamativo:
 * verifica los tokens con el mismo `JWT_SECRET`, por lo que cualquier
 * JWT válido para el backend es válido para este servicio.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: any) {
    return { id: payload.id, name: payload.name, email: payload.email };
  }
}
