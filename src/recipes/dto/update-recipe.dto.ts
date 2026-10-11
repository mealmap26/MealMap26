import { PartialType } from '@nestjs/swagger';
import { CreateRecipeDto } from './create-recipe.dto.js';

// Actualización parcial. Si se envía `ingredients`, reemplaza todas las líneas de la receta.
// null no se toma como "no enviado": se valida y responde 400 (salvo description, que admite null)
export class UpdateRecipeDto extends PartialType(CreateRecipeDto, {
  skipNullProperties: false,
}) {}
