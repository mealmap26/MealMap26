import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('categories')
// Índice único sobre LOWER("name"), creado por la migración AddLowerNameUniqueIndexes.
// synchronize: false porque TypeORM no sabe crear índices sobre expresiones; así tampoco lo borra.
@Index('IDX_categories_name_lower', { synchronize: false })
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;
}
