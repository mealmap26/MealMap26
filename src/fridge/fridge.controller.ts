import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';
import { Role } from '../users/enums/role.enum.js';
import { AddFridgeIngredientDto } from './dto/add-fridge-ingredient.dto.js';
import {
  FridgeItemResponse,
  FridgeSuggestionResponse,
} from './dto/fridge-response.dto.js';
import { SuggestionsQueryDto } from './dto/suggestions-query.dto.js';
import { FridgeService } from './fridge.service.js';

@ApiTags('Fridge')
@Controller('fridge')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.USER)
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Falta el token, es inválido, expiró o la sesión fue cerrada',
})
@ApiForbiddenResponse({
  description: 'Solo los usuarios con rol USER tienen nevera',
})
export class FridgeController {
  constructor(private readonly fridgeService: FridgeService) {}

  @Get()
  @ApiOperation({
    summary: 'Ver mi nevera',
    description:
      'Ingredientes disponibles del usuario (sin cantidades), ordenados por nombre.',
  })
  @ApiOkResponse({ type: [FridgeItemResponse] })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.fridgeService.list(user.id);
  }

  @Post()
  @ApiOperation({
    summary: 'Agregar un ingrediente a mi nevera',
    description:
      'Los ids de los ingredientes se consultan con GET /ingredients.',
  })
  @ApiCreatedResponse({ type: FridgeItemResponse })
  @ApiBadRequestResponse({
    description:
      'ingredientId falta o no es un UUID, o hay campos que no existen',
  })
  @ApiNotFoundResponse({ description: 'No existe un ingrediente con ese id' })
  @ApiConflictResponse({ description: 'El ingrediente ya está en la nevera' })
  add(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddFridgeIngredientDto,
  ) {
    return this.fridgeService.add(user.id, dto.ingredientId);
  }

  @Get('suggestions')
  @ApiOperation({
    summary: '¿Qué cocino con lo que tengo?',
    description:
      'Compara los ingredientes de cada receta con los de la nevera. Por defecto devuelve solo las recetas que se pueden preparar completas; con `maxMissing` incluye también las que tienen hasta ese número de ingredientes faltantes y dice cuáles son. Ordenadas por faltantes, proporción de coincidencia y nombre. Con la nevera vacía devuelve una lista vacía.',
  })
  @ApiOkResponse({ type: [FridgeSuggestionResponse] })
  @ApiBadRequestResponse({
    description: 'maxMissing no es un entero entre 0 y 5',
  })
  suggestions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SuggestionsQueryDto,
  ) {
    return this.fridgeService.suggestions(user.id, query.maxMissing ?? 0);
  }

  @Delete(':ingredientId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Quitar un ingrediente de mi nevera' })
  @ApiNoContentResponse({ description: 'Ingrediente quitado' })
  @ApiBadRequestResponse({ description: 'El id no es un UUID' })
  @ApiNotFoundResponse({ description: 'El ingrediente no está en la nevera' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ingredientId', ParseUUIDPipe) ingredientId: string,
  ) {
    return this.fridgeService.remove(user.id, ingredientId);
  }
}
