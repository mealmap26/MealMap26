import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Raw, Repository } from 'typeorm';
import { Recipe } from '../recipes/entities/recipe.entity.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { Category } from './entities/category.entity.js';

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
    await this.ensureNameIsFree(dto.name);
    return this.categories.save(this.categories.create({ name: dto.name }));
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOne(id);
    if (dto.name !== undefined) {
      await this.ensureNameIsFree(dto.name, id);
      category.name = dto.name;
    }
    return this.categories.save(category);
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

  // El nombre es único sin distinguir mayúsculas ("Snack" y "snack" son la misma categoría)
  private async ensureNameIsFree(name: string, excludeId?: string) {
    const existing = await this.categories.findOneBy({
      name: Raw((alias) => `LOWER(${alias}) = LOWER(:name)`, { name }),
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException('Ya existe una categoría con ese nombre');
    }
  }
}
