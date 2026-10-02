import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LoginAuthDto {
  @ApiProperty({
    description:
      'Usuario del backend. Si se omite se usa la variable de entorno BACKEND_USER.',
    example: 'admin',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El usuario debe ser una cadena de texto.' })
  user?: string;

  @ApiProperty({
    description:
      'Contraseña del backend. Si se omite se usa la variable de entorno BACKEND_PASSWORD.',
    example: '123456',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La contraseña debe ser una cadena de texto.' })
  password?: string;
}
