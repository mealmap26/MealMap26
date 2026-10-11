import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Category } from '../../categories/entities/category.entity.js';
import { decimalTransformer } from '../../common/transformers/decimal.transformer.js';

@Entity('recipes')
// Índice único sobre LOWER("name"), creado por la migración AddLowerNameUniqueIndexes.
// synchronize: false porque TypeORM no sabe crear índices sobre expresiones; así tampoco lo borra.
@Index('IDX_recipes_name_lower', { synchronize: false })
export class Recipe {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'int' })
  prepTimeMinutes: number;

  // Macros por porción
  @Column({ type: 'numeric', precision: 7, scale: 2, transformer: decimalTransformer })
  calories: number;

  @Column({ type: 'numeric', precision: 7, scale: 2, transformer: decimalTransformer })
  protein: number;

  @Column({ type: 'numeric', precision: 7, scale: 2, transformer: decimalTransformer })
  carbs: number;

  @Column({ type: 'numeric', precision: 7, scale: 2, transformer: decimalTransformer })
  fat: number;

  // Número de porciones que rinde la receta completa
  @Column({ type: 'int', default: 1 })
  servingSize: number;

  @Column()
  categoryId: string;

  @ManyToOne(() => Category, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @CreateDateColumn()
  createdAt: Date;
}
