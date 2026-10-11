import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { Role } from '../enums/role.enum.js';

export class UpdateRoleDto {
  @ApiProperty({
    enum: Role,
    example: Role.ADMIN,
    description: 'Rol nuevo del usuario',
  })
  @IsEnum(Role)
  role: Role;
}
