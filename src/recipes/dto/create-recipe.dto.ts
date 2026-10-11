import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { RecipeIngredientLineDto } from './recipe-ingredient-line.dto.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Los macros no se envían: el servidor los calcula a partir de los ingredientes
export class CreateRecipeDto {
  @ApiProperty({
    example: 'Pollo al curry con arroz',
    description: 'Nombre único (sin distinguir mayúsculas)',
  })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Pollo en salsa de curry con arroz blanco.',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ApiProperty({
    example: 25,
    description: 'Tiempo de preparación en minutos (1 a 600)',
  })
  @IsInt()
  @Min(1)
  @Max(600)
  prepTimeMinutes: number;

  @ApiProperty({
    example: 2,
    description: 'Porciones que rinde la receta completa (1 a 50)',
  })
  @IsInt()
  @Min(1)
  @Max(50)
  servingSize: number;

  @ApiProperty({
    example: '0b6f2a1e-6f0c-4d63-9a43-3f0f5b1f2c7d',
    description: 'Id de la categoría',
  })
  @IsUUID()
  categoryId: string;

  @ApiProperty({
    type: [RecipeIngredientLineDto],
    description:
      'Al menos un ingrediente; un mismo ingrediente no puede repetirse',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique((line: RecipeIngredientLineDto) => line?.ingredientId, {
    message: 'Un ingrediente no puede repetirse en la misma receta',
  })
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientLineDto)
  ingredients: RecipeIngredientLineDto[];
}
