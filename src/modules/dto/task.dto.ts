import { IsString, IsOptional, IsBoolean, IsInt, IsDate } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  status?: boolean;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsDate()
  dueDate?: Date;

  @IsOptional()
  @IsDate()
  reminder?: Date;

  @IsOptional()
  repeatType?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
}

export class UpdateTaskDto extends CreateTaskDto {}
