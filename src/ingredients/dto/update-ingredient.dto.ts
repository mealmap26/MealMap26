import { PartialType } from '@nestjs/swagger';
import { CreateIngredientDto } from './create-ingredient.dto.js';

// Mismas reglas que al crear, pero todos los campos son opcionales.
// Si cambia algún macro o gramsPerUnit se recalculan las recetas que usan el ingrediente.
export class UpdateIngredientDto extends PartialType(CreateIngredientDto, {
  // null no se toma como "no enviado": se valida y responde 400 (salvo gramsPerUnit, que admite null)
  skipNullProperties: false,
}) {}
