import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class SuggestionsQueryDto {
  @ApiPropertyOptional({
    default: 0,
    minimum: 0,
    maximum: 5,
    description:
      'Cuántos ingredientes pueden faltar. Con 0 solo salen las recetas que se pueden preparar completas',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  maxMissing?: number;
}
