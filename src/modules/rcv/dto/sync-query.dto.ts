import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class SyncQueryDto {
  @ApiProperty({
    description: 'Mes a sincronizar (1-12). Default: mes actual',
    required: false,
    example: 9,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'mes debe ser un número entero' })
  @Min(1, { message: 'mes debe estar entre 1 y 12' })
  @Max(12, { message: 'mes debe estar entre 1 y 12' })
  mes?: number;

  @ApiProperty({
    description: 'Año a sincronizar. Default: año actual',
    required: false,
    example: 2026,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'anio debe ser un número entero' })
  @Min(2000, { message: 'anio debe ser válido' })
  @Max(2100, { message: 'anio debe ser válido' })
  anio?: number;
}
