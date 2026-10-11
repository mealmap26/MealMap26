import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
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
import { MacrosResponseDto } from './dto/macros-response.dto.js';
import { UpdateMacrosDto } from './dto/update-macros.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { UserResponseDto } from './dto/user-response.dto.js';
import { Role } from './enums/role.enum.js';
import { UsersService } from './users.service.js';

const UNAUTHORIZED =
  'Falta el token, es inválido, expiró o la sesión fue cerrada';
const ADMIN_ONLY =
  'Solo los usuarios con rol ADMIN pueden administrar los roles';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Listar usuarios',
    description:
      'Devuelve los usuarios ordenados por fecha de registro, para que el ADMIN encuentre el id al que le va a cambiar el rol. Nunca incluye la contraseña ni el secreto del 2FA.',
  })
  @ApiOkResponse({ type: UserResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ description: UNAUTHORIZED })
  @ApiForbiddenResponse({ description: ADMIN_ONLY })
  findAll() {
    return this.usersService.findAll();
  }

  @Patch('me/macros')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Actualizar mis metas diarias de macros',
    description:
      'Actualización parcial: solo se cambian las metas que se envíen. Las cuatro metas deben estar configuradas para poder generar el plan semanal.',
  })
  @ApiOkResponse({
    type: MacrosResponseDto,
    description: 'Las 4 metas resultantes (null las que aún no se configuran)',
  })
  @ApiBadRequestResponse({
    description: 'Valor fuera de rango, no entero o campo desconocido',
  })
  @ApiUnauthorizedResponse({ description: UNAUTHORIZED })
  updateMacros(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateMacrosDto,
  ) {
    return this.usersService.updateMacros(user.id, dto);
  }

  @Patch(':id/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Asignar el rol de un usuario',
    description:
      'El ADMIN cambia el rol de otro usuario (USER o ADMIN). Enviar el rol que ya tiene responde 200 sin cambios. El rol se lee del token, así que el cambio aplica desde el siguiente login del usuario.',
  })
  @ApiOkResponse({
    type: UserResponseDto,
    description: 'El usuario con su rol resultante',
  })
  @ApiBadRequestResponse({
    description:
      'El id no es un UUID, el rol no es válido o el ADMIN intenta cambiar su propio rol',
  })
  @ApiUnauthorizedResponse({ description: UNAUTHORIZED })
  @ApiForbiddenResponse({ description: ADMIN_ONLY })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado' })
  changeRole(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.usersService.changeRole(admin.id, id, dto.role);
  }
}
