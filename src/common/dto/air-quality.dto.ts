import { IsString, IsNumber, IsOptional, IsDate, IsEnum, IsInt, Min, Max, IsArray, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class GetAirQualityDto {
  @IsString()
  city: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  country: string;
}

export class GetAirQualityByLocationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  @Transform(({ value }) => parseFloat(value))
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  @Transform(({ value }) => parseFloat(value))
  longitude: number;
}

export class GetHistoryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  @Transform(({ value }) => parseInt(value))
  days?: number = 7;
}

export class GetDailyStatsDto {
  @IsString()
  @Transform(({ value }) => {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date format. Use YYYY-MM-DD');
    }
    return value;
  })
  date: string;
}

export class CreateAirQualityDto {
  @IsString()
  city: string;

  @IsString()
  state: string;

  @IsString()
  country: string;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsNumber()
  aqius: number;

  @IsString()
  mainus: string;

  @IsNumber()
  aqicn: number;

  @IsString()
  maincn: string;

  @IsNumber()
  temperature: number;

  @IsNumber()
  pressure: number;

  @IsNumber()
  humidity: number;

  @IsNumber()
  windSpeed: number;

  @IsNumber()
  windDirection: number;

  @IsString()
  weatherIcon: string;

  @Transform(({ value }) => new Date(value))
  @Type(() => Date)
  @IsDate()
  timestamp: Date;
}

export class ApiResponseMetadata {
  cached: boolean;
  dataFreshness: number;
  responseTime: Date;
  version: string;
  cacheTtl?: number;
}

export class AirQualityResponseDto {
  @IsString()
  city: string;

  @IsString()
  state: string;

  @IsString()
  country: string;

  @IsNumber()
  aqius: number;

  @IsString()
  mainus: string;

  @IsNumber()
  aqicn: number;

  @IsString()
  maincn: string;

  @IsNumber()
  temperature: number;

  @IsNumber()
  pressure: number;

  @IsNumber()
  humidity: number;

  @IsNumber()
  windSpeed: number;

  @IsNumber()
  windDirection: number;

  @IsString()
  weatherIcon: string;

  @IsDate()
  timestamp: Date;

  @IsEnum(['Good', 'Moderate', 'Unhealthy for Sensitive Groups', 'Unhealthy', 'Very Unhealthy', 'Hazardous'])
  level: string;

  location: {
    latitude: number;
    longitude: number;
  };
}

export class StandardizedApiResponse<T> {
  success: boolean;
  data: T;
  @ValidateNested()
  @Type(() => ApiResponseMetadata)
  metadata: ApiResponseMetadata;
  message?: string;
}

export class DailyStatsResponseDto {
  date: string;
  city: string;
  country: string;
  averageAqi: number;
  minAqi: number;
  maxAqi: number;
  dominantPollutant: string;
  measurementCount: number;
  unhealthyHours: number;
}

export class MostPollutedTimeResponseDto {
  dateTime: Date;
  aqi: number;
  pollutant: string;
  level: string;
  city: string;
  country: string;
}

export class AirQualityAlertDto {
  @IsString()
  id: string;

  @IsString()
  city: string;

  @IsNumber()
  aqi: number;

  @IsEnum(['Good', 'Moderate', 'Unhealthy for Sensitive Groups', 'Unhealthy', 'Very Unhealthy', 'Hazardous'])
  level: string;

  @IsDate()
  timestamp: Date;

  @IsOptional()
  isActive?: boolean;
} 