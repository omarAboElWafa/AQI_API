import { IsString, IsNumber, IsOptional, IsDate, IsEnum } from 'class-validator';
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