import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { decimalTransformer } from '../../common/transformers/decimal.transformer.js';

@Entity('ingredients')
// Índice único sobre LOWER("name"), creado por la migración AddLowerNameUniqueIndexes.
// synchronize: false porque TypeORM no sabe crear índices sobre expresiones; así tampoco lo borra.
@Index('IDX_ingredients_name_lower', { synchronize: false })
export class Ingredient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({
    type: 'numeric',
    precision: 7,
    scale: 2,
    transformer: decimalTransformer,
  })
  caloriesPer100g: number;

  @Column({
    type: 'numeric',
    precision: 7,
    scale: 2,
    transformer: decimalTransformer,
  })
  proteinPer100g: number;

  @Column({
    type: 'numeric',
    precision: 7,
    scale: 2,
    transformer: decimalTransformer,
  })
  carbsPer100g: number;

  @Column({
    type: 'numeric',
    precision: 7,
    scale: 2,
    transformer: decimalTransformer,
  })
  fatPer100g: number;

  // Peso aproximado de una unidad (g); necesario para recetas que usan 'unidad'
  @Column({
    type: 'numeric',
    precision: 7,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  gramsPerUnit: number | null;
}
