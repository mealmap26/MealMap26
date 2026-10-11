import { PartialType } from '@nestjs/swagger';
import { CreateCategoryDto } from './create-category.dto.js';

// Mismas reglas que al crear, pero todos los campos son opcionales
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
