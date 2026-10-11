import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { decimalTransformer } from '../../common/transformers/decimal.transformer.js';

@Entity('ingredients')
export class Ingredient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'numeric', precision: 7, scale: 2, transformer: decimalTransformer })
  caloriesPer100g: number;

  @Column({ type: 'numeric', precision: 7, scale: 2, transformer: decimalTransformer })
  proteinPer100g: number;

  @Column({ type: 'numeric', precision: 7, scale: 2, transformer: decimalTransformer })
  carbsPer100g: number;

  @Column({ type: 'numeric', precision: 7, scale: 2, transformer: decimalTransformer })
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
