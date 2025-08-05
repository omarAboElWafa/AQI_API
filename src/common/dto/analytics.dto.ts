import { 
  IsString, 
  IsNumber, 
  IsOptional, 
  IsDate, 
  IsEnum, 
  IsObject,
  ValidateNested,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  Min,
  Max,
  Matches
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class PeakAqiDto {
  @IsNumber()
  @Min(0)
  @Max(500)
  value: number;

  @IsString()
  time: string;
}

export class HourlyAverageDto {
  @IsNumber()
  @Min(0)
  @Max(23)
  hour: number;

  @IsNumber()
  @Min(0)
  @Max(500)
  avg_aqi: number;
}

export class DailyStatsDto {
  @IsNumber()
  @Min(0)
  @Max(500)
  avg_aqi: number;

  @ValidateNested()
  @Type(() => PeakAqiDto)
  peak_aqi: PeakAqiDto;

  @ValidateNested()
  @Type(() => PeakAqiDto)
  min_aqi: PeakAqiDto;

  @IsString()
  dominant_pollutant: string;

  @IsObject()
  pollution_level_distribution: Record<string, number>;
}

export class CreateDailyAggregationDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format' })
  date: string;

  @IsString()
  location: string;

  @ValidateNested()
  @Type(() => DailyStatsDto)
  daily_stats: DailyStatsDto;

  @IsArray()
  @ArrayMinSize(24)
  @ArrayMaxSize(24)
  @ValidateNested({ each: true })
  @Type(() => HourlyAverageDto)
  hourly_averages: HourlyAverageDto[];

  @IsOptional()
  @Transform(({ value }) => new Date(value))
  @Type(() => Date)
  @IsDate()
  calculated_at?: Date;

  @IsNumber()
  @Min(0)
  record_count: number;
}

export class DailyAggregationResponseDto {
  @IsString()
  id: string;

  @IsString()
  date: string;

  @IsString()
  location: string;

  @ValidateNested()
  @Type(() => DailyStatsDto)
  daily_stats: DailyStatsDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HourlyAverageDto)
  hourly_averages: HourlyAverageDto[];

  @IsDate()
  calculated_at: Date;

  @IsNumber()
  record_count: number;

  @IsDate()
  createdAt: Date;

  @IsDate()
  updatedAt: Date;
}

export class MostPollutedTimeDto {
  @IsString()
  location: string;

  @IsString()
  date: string;

  @IsNumber()
  @Min(0)
  @Max(23)
  hour: number;

  @IsNumber()
  @Min(0)
  @Max(500)
  avg_aqi: number;

  @IsString()
  dominant_pollutant: string;

  @IsString()
  pollution_level: string;
}

export class AnalyticsQueryDto {
  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Start date must be in YYYY-MM-DD format' })
  startDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'End date must be in YYYY-MM-DD format' })
  endDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(500)
  minAqi?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(500)
  maxAqi?: number;

  @IsOptional()
  @IsString()
  pollutant?: string;

  @IsOptional()
  @IsEnum(['Good', 'Moderate', 'Unhealthy for Sensitive Groups', 'Unhealthy', 'Very Unhealthy', 'Hazardous'])
  pollution_level?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 30;

  @IsOptional()
  @IsNumber()
  @Min(0)
  skip?: number = 0;
}

export class AnalyticsReportDto {
  @IsString()
  location: string;

  @IsString()
  period: string;

  @IsNumber()
  @Min(0)
  @Max(500)
  averageAQI: number;

  @IsNumber()
  @Min(0)
  @Max(500)
  maxAQI: number;

  @IsNumber()
  @Min(0)
  @Max(500)
  minAQI: number;

  @IsNumber()
  @Min(0)
  unhealthyDays: number;

  @IsNumber()
  @Min(0)
  totalDays: number;

  @IsEnum(['improving', 'worsening', 'stable'])
  trend: string;
} 