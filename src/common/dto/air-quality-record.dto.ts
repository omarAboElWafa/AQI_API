import { 
  IsString, 
  IsNumber, 
  IsOptional, 
  IsDate, 
  IsEnum, 
  IsBoolean, 
  Min, 
  Max, 
  IsObject,
  ValidateNested,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CoordinatesDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;
}

export class WeatherDto {
  @IsNumber()
  @Min(-50)
  @Max(60)
  temperature: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  humidity: number;
}

export class MetadataDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  api_response_time?: number;

  @IsOptional()
  @IsBoolean()
  cached?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  retry_count?: number;
}

export class CreateAirQualityRecordDto {
  @IsString()
  location: string;

  @ValidateNested()
  @Type(() => CoordinatesDto)
  coordinates: CoordinatesDto;

  @Transform(({ value }) => new Date(value))
  @Type(() => Date)
  @IsDate()
  timestamp: Date;

  @IsNumber()
  @Min(0)
  @Max(500)
  aqi: number;

  @IsEnum(['p1', 'p2', 'p3', 'p4', 'p5', 'n2', 's4', 'co', 'o3', 'no2', 'so2'])
  main_pollutant: string;

  @IsEnum(['Good', 'Moderate', 'Unhealthy for Sensitive Groups', 'Unhealthy', 'Very Unhealthy', 'Hazardous'])
  pollution_level: string;

  @ValidateNested()
  @Type(() => WeatherDto)
  weather: WeatherDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MetadataDto)
  metadata?: MetadataDto;
}

export class AirQualityResponseDto {
  @IsString()
  id: string;

  @IsString()
  location: string;

  @ValidateNested()
  @Type(() => CoordinatesDto)
  coordinates: CoordinatesDto;

  @IsDate()
  timestamp: Date;

  @IsNumber()
  @Min(0)
  @Max(500)
  aqi: number;

  @IsString()
  main_pollutant: string;

  @IsString()
  pollution_level: string;

  @ValidateNested()
  @Type(() => WeatherDto)
  weather: WeatherDto;

  @ValidateNested()
  @Type(() => MetadataDto)
  metadata: MetadataDto;

  @IsDate()
  createdAt: Date;

  @IsDate()
  updatedAt: Date;
}

export class UpdateAirQualityRecordDto {
  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CoordinatesDto)
  coordinates?: CoordinatesDto;

  @IsOptional()
  @Transform(({ value }) => new Date(value))
  @Type(() => Date)
  @IsDate()
  timestamp?: Date;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(500)
  aqi?: number;

  @IsOptional()
  @IsEnum(['p1', 'p2', 'p3', 'p4', 'p5', 'n2', 's4', 'co', 'o3', 'no2', 'so2'])
  main_pollutant?: string;

  @IsOptional()
  @IsEnum(['Good', 'Moderate', 'Unhealthy for Sensitive Groups', 'Unhealthy', 'Very Unhealthy', 'Hazardous'])
  pollution_level?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => WeatherDto)
  weather?: WeatherDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MetadataDto)
  metadata?: MetadataDto;
}

export class AirQualityQueryDto {
  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @Transform(({ value }) => new Date(value))
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @IsOptional()
  @Transform(({ value }) => new Date(value))
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

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
  @IsEnum(['p1', 'p2', 'p3', 'p4', 'p5', 'n2', 's4', 'co', 'o3', 'no2', 'so2'])
  pollutant?: string;

  @IsOptional()
  @IsEnum(['Good', 'Moderate', 'Unhealthy for Sensitive Groups', 'Unhealthy', 'Very Unhealthy', 'Hazardous'])
  pollution_level?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number = 100;

  @IsOptional()
  @IsNumber()
  @Min(0)
  skip?: number = 0;
} 