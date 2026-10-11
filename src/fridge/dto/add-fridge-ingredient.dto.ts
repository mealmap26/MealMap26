import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AddFridgeIngredientDto {
  @ApiProperty({
    example: '3262729e-49fe-4abd-9338-22d9ee8a9f38',
    description: 'Id del ingrediente (se consulta con GET /ingredients)',
  })
  @IsUUID()
  ingredientId: string;
}
