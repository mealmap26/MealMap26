import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../enums/role.enum.js';

// Datos públicos de un usuario para la administración de roles (nunca la contraseña ni el secreto del 2FA).
// El plugin de Swagger lee los comentarios: la primera línea es la descripción y @example el ejemplo.
export class UserResponseDto {
  /**
   * Id del usuario
   * @example 8f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b
   */
  id: string;

  /**
   * Email del usuario
   * @example "ana@example.com"
   */
  email: string;

  @ApiProperty({ enum: Role, example: Role.USER })
  role: Role;

  /**
   * Si tiene activo el 2FA
   * @example false
   */
  twoFAEnabled: boolean;

  /**
   * Fecha de registro
   * @example 2026-10-01T12:00:00.000Z
   */
  createdAt: Date;
}
