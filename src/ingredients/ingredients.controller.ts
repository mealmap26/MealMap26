import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Role } from '../users/enums/role.enum.js';
import { CreateIngredientDto } from './dto/create-ingredient.dto.js';
import { IngredientResponse } from './dto/ingredient-response.dto.js';
import { ListIngredientsQueryDto } from './dto/list-ingredients-query.dto.js';
import { UpdateIngredientDto } from './dto/update-ingredient.dto.js';
import { IngredientsService } from './ingredients.service.js';

const NOT_FOUND = 'No existe un ingrediente con ese id';
const ONLY_ADMIN = 'Solo un ADMIN puede modificar el catálogo';
const DUPLICATED = 'Ya existe un ingrediente con ese nombre';

@ApiTags('Ingredients')
@Controller('ingredients')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Falta el token, es inválido, expiró o la sesión fue cerrada' })
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar ingredientes',
    description:
      'Disponible para cualquier usuario autenticado (por ejemplo, para saber qué ids agregar a la nevera). Ordenados por nombre; `search` filtra por nombre.',
  })
  @ApiOkResponse({ type: [IngredientResponse] })
  @ApiBadRequestResponse({ description: 'El texto de búsqueda es muy largo' })
  findAll(@Query() query: ListIngredientsQueryDto) {
    return this.ingredientsService.findAll(query.search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver un ingrediente' })
  @ApiOkResponse({ type: IngredientResponse })
  @ApiBadRequestResponse({ description: 'El id no es un UUID' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ingredientsService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Crear un ingrediente (ADMIN)',
    description: 'Los valores nutricionales son por 100 g, entre 0 y 900 y con máximo 2 decimales.',
  })
  @ApiCreatedResponse({ type: IngredientResponse })
  @ApiBadRequestResponse({ description: 'Falta un campo, un valor está fuera de rango o hay campos que no existen' })
  @ApiForbiddenResponse({ description: ONLY_ADMIN })
  @ApiConflictResponse({ description: DUPLICATED })
  create(@Body() dto: CreateIngredientDto) {
    return this.ingredientsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Editar un ingrediente (ADMIN)',
    description:
      'Actualización parcial. Si cambia algún valor nutricional o `gramsPerUnit`, se recalculan los macros por porción de todas las recetas que lo usan.',
  })
  @ApiOkResponse({ type: IngredientResponse })
  @ApiBadRequestResponse({
    description:
      "El id no es un UUID, un valor no es válido o se intenta quitar `gramsPerUnit` a un ingrediente usado en 'unidad' por alguna receta",
  })
  @ApiForbiddenResponse({ description: ONLY_ADMIN })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  @ApiConflictResponse({ description: DUPLICATED })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIngredientDto,
  ) {
    return this.ingredientsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Eliminar un ingrediente (ADMIN)',
    description: 'Solo se puede eliminar si ninguna receta lo usa. Se quita también de las neveras de los usuarios.',
  })
  @ApiNoContentResponse({ description: 'Ingrediente eliminado' })
  @ApiBadRequestResponse({ description: 'El id no es un UUID' })
  @ApiForbiddenResponse({ description: ONLY_ADMIN })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  @ApiConflictResponse({ description: 'El ingrediente está en uso en alguna receta' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.ingredientsService.remove(id);
  }
}
