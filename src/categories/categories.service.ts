import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { conflictOnUniqueViolation } from '../common/database/pg-errors.js';
import { ensureNameIsFree } from '../common/database/unique-name.js';
import { Recipe } from '../recipes/entities/recipe.entity.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { Category } from './entities/category.entity.js';

const NAME_TAKEN = 'Ya existe una categoría con ese nombre';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
    @InjectRepository(Recipe) private readonly recipes: Repository<Recipe>,
  ) {}

  findAll(): Promise<Category[]> {
    return this.categories.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.categories.findOneBy({ id });
    if (!category) throw new NotFoundException('Categoría no encontrada');
    return category;
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    await ensureNameIsFree(this.categories, dto.name, NAME_TAKEN);
    return conflictOnUniqueViolation(
      () => this.categories.save(this.categories.create({ name: dto.name })),
      NAME_TAKEN,
    );
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOne(id);
    if (dto.name !== undefined) {
      await ensureNameIsFree(this.categories, dto.name, NAME_TAKEN, id);
      category.name = dto.name;
    }
    return conflictOnUniqueViolation(
      () => this.categories.save(category),
      NAME_TAKEN,
    );
  }

  // No se puede borrar una categoría que tenga recetas (la llave foránea es RESTRICT)
  async remove(id: string): Promise<void> {
    const category = await this.findOne(id);
    if (await this.recipes.existsBy({ categoryId: id })) {
      throw new ConflictException(
        'No se puede eliminar la categoría porque tiene recetas asociadas',
      );
    }
    await this.categories.remove(category);
  }
}
