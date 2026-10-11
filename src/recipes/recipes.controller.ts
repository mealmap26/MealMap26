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
import { CreateRecipeDto } from './dto/create-recipe.dto.js';
import { ListRecipesQueryDto } from './dto/list-recipes-query.dto.js';
import {
  RecipeDetailResponse,
  RecipeSummaryResponse,
} from './dto/recipe-response.dto.js';
import { UpdateRecipeDto } from './dto/update-recipe.dto.js';
import { RecipesService } from './recipes.service.js';

const NOT_FOUND = 'No existe una receta con ese id';
const ONLY_ADMIN = 'Solo un ADMIN puede modificar el catálogo';
const DUPLICATED = 'Ya existe una receta con ese nombre';
const INVALID_BODY =
  "Un campo no es válido, hay campos que no existen (por ejemplo los macros, que los calcula el servidor), un ingrediente está repetido o se usa 'unidad' con un ingrediente sin gramsPerUnit";

@ApiTags('Recipes')
@Controller('recipes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Falta el token, es inválido, expiró o la sesión fue cerrada' })
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar recetas',
    description:
      'Disponible para cualquier usuario autenticado. Ordenadas por nombre. Los filtros son opcionales y se combinan; los macros son por porción.',
  })
  @ApiOkResponse({ type: [RecipeSummaryResponse] })
  @ApiBadRequestResponse({ description: 'Algún filtro no es válido (por ejemplo categoryId no es un UUID o maxPrepTime no es un entero)' })
  findAll(@Query() query: ListRecipesQueryDto) {
    return this.recipesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Ver una receta con sus ingredientes',
    description: 'Las cantidades de los ingredientes son para la receta completa; los macros, por porción.',
  })
  @ApiOkResponse({ type: RecipeDetailResponse })
  @ApiBadRequestResponse({ description: 'El id no es un UUID' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.recipesService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Crear una receta (ADMIN)',
    description:
      'Las cantidades son para la receta completa. Los macros por porción los calcula el servidor: suma los valores por 100 g de cada ingrediente (ml como g, `unidad` con gramsPerUnit) y divide entre `servingSize`.',
  })
  @ApiCreatedResponse({ type: RecipeDetailResponse })
  @ApiBadRequestResponse({ description: INVALID_BODY })
  @ApiForbiddenResponse({ description: ONLY_ADMIN })
  @ApiNotFoundResponse({ description: 'La categoría o alguno de los ingredientes no existe (el mensaje dice cuáles)' })
  @ApiConflictResponse({ description: DUPLICATED })
  create(@Body() dto: CreateRecipeDto) {
    return this.recipesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Editar una receta (ADMIN)',
    description:
      'Actualización parcial. Si se envía `ingredients`, reemplaza todas las líneas. Los macros se recalculan cuando cambian los ingredientes o `servingSize`.',
  })
  @ApiOkResponse({ type: RecipeDetailResponse })
  @ApiBadRequestResponse({ description: `El id no es un UUID. ${INVALID_BODY}` })
  @ApiForbiddenResponse({ description: ONLY_ADMIN })
  @ApiNotFoundResponse({ description: 'La receta, la categoría o alguno de los ingredientes no existe' })
  @ApiConflictResponse({ description: DUPLICATED })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRecipeDto) {
    return this.recipesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Eliminar una receta (ADMIN)',
    description: 'Borra también sus líneas de ingredientes. No se puede si está asignada en algún plan semanal.',
  })
  @ApiNoContentResponse({ description: 'Receta eliminada' })
  @ApiBadRequestResponse({ description: 'El id no es un UUID' })
  @ApiForbiddenResponse({ description: ONLY_ADMIN })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  @ApiConflictResponse({ description: 'La receta está asignada en algún plan semanal' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.recipesService.remove(id);
  }
}
