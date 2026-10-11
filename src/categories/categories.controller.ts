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
import { CategoriesService } from './categories.service.js';
import { CategoryResponse } from './dto/category-response.dto.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

const NOT_FOUND = 'No existe una categoría con ese id';
const ONLY_ADMIN = 'Solo un ADMIN puede modificar el catálogo';
const DUPLICATED = 'Ya existe una categoría con ese nombre';

@ApiTags('Categories')
@Controller('categories')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Falta el token, es inválido, expiró o la sesión fue cerrada' })
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar categorías',
    description: 'Disponible para cualquier usuario autenticado. Ordenadas por nombre.',
  })
  @ApiOkResponse({ type: [CategoryResponse] })
  findAll() {
    return this.categoriesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver una categoría' })
  @ApiOkResponse({ type: CategoryResponse })
  @ApiBadRequestResponse({ description: 'El id no es un UUID' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriesService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Crear una categoría (ADMIN)',
    description: 'El nombre se guarda sin espacios al inicio ni al final y no puede repetirse (sin distinguir mayúsculas).',
  })
  @ApiCreatedResponse({ type: CategoryResponse })
  @ApiBadRequestResponse({ description: 'Nombre vacío, muy corto (mínimo 2), muy largo (máximo 60) o campos que no existen' })
  @ApiForbiddenResponse({ description: ONLY_ADMIN })
  @ApiConflictResponse({ description: DUPLICATED })
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Renombrar una categoría (ADMIN)' })
  @ApiOkResponse({ type: CategoryResponse })
  @ApiBadRequestResponse({ description: 'El id no es un UUID o el nombre no es válido' })
  @ApiForbiddenResponse({ description: ONLY_ADMIN })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  @ApiConflictResponse({ description: DUPLICATED })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Eliminar una categoría (ADMIN)',
    description: 'Solo se puede eliminar si ninguna receta la usa.',
  })
  @ApiNoContentResponse({ description: 'Categoría eliminada' })
  @ApiBadRequestResponse({ description: 'El id no es un UUID' })
  @ApiForbiddenResponse({ description: ONLY_ADMIN })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  @ApiConflictResponse({ description: 'La categoría tiene recetas asociadas' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriesService.remove(id);
  }
}
