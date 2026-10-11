import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

// Filtros opcionales del listado de recetas; se combinan entre sí
export class ListRecipesQueryDto {
  @ApiPropertyOptional({ description: 'Solo recetas de esta categoría' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ example: 'pollo', description: 'El nombre contiene este texto (sin distinguir mayúsculas)' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ example: 20, description: 'Tiempo de preparación máximo (minutos)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxPrepTime?: number;

  @ApiPropertyOptional({ example: 500, description: 'Calorías por porción máximas' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxCalories?: number;

  @ApiPropertyOptional({ example: 30, description: 'Proteína por porción mínima (g)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minProtein?: number;
}
