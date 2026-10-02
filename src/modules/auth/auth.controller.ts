import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiBody, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginAuthDto } from './dto/login.dto';
import { ResponseDto } from 'src/common/dto/response.dto';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Envia una peticion POST al login del backend de Llamativo y devuelve
   * el JWT resultante. Sirve para obtener un token sin conocer la URL del
   * backend y para validar credenciales.
   *
   * Si no se envia body, se usan BACKEND_USER / BACKEND_PASSWORD.
   */
  @Post('login')
  @ApiBody({
    description: 'Credenciales de login (opcionales si usan las de entorno)',
    type: LoginAuthDto,
    examples: {
      explicito: {
        summary: 'Con credenciales en el body',
        value: { user: 'admin', password: '123456' },
      },
      porEntorno: {
        summary: 'Usando BACKEND_USER / BACKEND_PASSWORD',
        value: {},
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Login exitoso', type: ResponseDto })
  @ApiResponse({ status: 401, description: 'Credenciales invalidas' })
  async login(@Body() loginAuthDto: LoginAuthDto): Promise<ResponseDto> {
    return await this.authService.login(loginAuthDto || {});
  }
}
