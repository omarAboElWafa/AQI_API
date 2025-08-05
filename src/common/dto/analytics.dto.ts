import { IsString, IsOptional, IsNumber, IsEnum, IsDateString, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DailyStatsDto {
  @ApiProperty({ description: 'Date in YYYY-MM-DD format' })
  date: string;

  @ApiProperty({ description: 'City name' })
  city: string;

  @ApiProperty({ description: 'Country name' })
  country: string;

  @ApiProperty({ description: 'Average AQI for the day', minimum: 0, maximum: 500 })
  averageAQI: number;

  @ApiProperty({ description: 'Maximum AQI for the day', minimum: 0, maximum: 500 })
  maxAQI: number;

  @ApiProperty({ description: 'Minimum AQI for the day', minimum: 0, maximum: 500 })
  minAQI: number;

  @ApiProperty({ description: 'Dominant pollutant for the day' })
  dominantPollutant: string;

  @ApiProperty({ 
    description: 'Pollution level category',
    enum: ['Good', 'Moderate', 'Unhealthy for Sensitive Groups', 'Unhealthy', 'Very Unhealthy', 'Hazardous']
  })
  pollutionLevel: 'Good' | 'Moderate' | 'Unhealthy for Sensitive Groups' | 'Unhealthy' | 'Very Unhealthy' | 'Hazardous';

  @ApiProperty({ description: 'Hourly averages for the day', type: [Object] })
  hourlyAverages: Array<{
    hour: number;
    averageAQI: number;
    recordCount: number;
  }>;

  @ApiProperty({ description: 'Total number of records for the day' })
  totalRecords: number;

  @ApiProperty({ description: 'Hours with missing data (0-23)', type: [Number] })
  missingDataHours: number[];

  @ApiProperty({ description: 'Last updated timestamp' })
  lastUpdated: Date;
}

export class HourlyStatsDto {
  @ApiProperty({ description: 'Hour of the day (0-23)', minimum: 0, maximum: 23 })
  hour: number;

  @ApiProperty({ description: 'Average AQI for this hour', minimum: 0, maximum: 500 })
  averageAQI: number;

  @ApiProperty({ description: 'Maximum AQI for this hour', minimum: 0, maximum: 500 })
  maxAQI: number;

  @ApiProperty({ description: 'Minimum AQI for this hour', minimum: 0, maximum: 500 })
  minAQI: number;

  @ApiProperty({ description: 'Dominant pollutant for this hour' })
  dominantPollutant: string;

  @ApiProperty({ description: 'Number of records for this hour' })
  recordCount: number;

  @ApiProperty({ description: 'Average weather conditions for this hour' })
  weatherAverage: {
    temperature: number;
    humidity: number;
    pressure: number;
    windSpeed: number;
  };
}

export class HistoricalTrendDto {
  @ApiProperty({ description: 'Date in YYYY-MM-DD format' })
  date: string;

  @ApiProperty({ description: 'Average AQI for the day', minimum: 0, maximum: 500 })
  averageAQI: number;

  @ApiProperty({ description: 'Maximum AQI for the day', minimum: 0, maximum: 500 })
  maxAQI: number;

  @ApiProperty({ description: 'Minimum AQI for the day', minimum: 0, maximum: 500 })
  minAQI: number;

  @ApiProperty({ description: 'Dominant pollutant for the day' })
  dominantPollutant: string;

  @ApiProperty({ description: 'Number of records for the day' })
  recordCount: number;
}

export class PollutionPatternDto {
  @ApiProperty({ description: 'Time slot (e.g., "14:00")' })
  timeSlot: string;

  @ApiProperty({ description: 'Average AQI for this time slot', minimum: 0, maximum: 500 })
  averageAQI: number;

  @ApiProperty({ description: 'Frequency of occurrence' })
  frequency: number;

  @ApiProperty({ description: 'Dominant pollutant for this time slot' })
  dominantPollutant: string;

  @ApiProperty({ description: 'Pollution level category' })
  pollutionLevel: string;
}

export class MostPollutedTimeDto {
  @ApiProperty({ description: 'Timestamp of the most polluted time' })
  timestamp: Date;

  @ApiProperty({ description: 'AQI value at the most polluted time', minimum: 0, maximum: 500 })
  aqi: number;

  @ApiProperty({ description: 'Pollutant at the most polluted time' })
  pollutant: string;

  @ApiProperty({ description: 'City name' })
  city: string;

  @ApiProperty({ description: 'Country name' })
  country: string;

  @ApiProperty({ description: 'Weather conditions at the most polluted time' })
  weather: {
    temperature: number;
    humidity: number;
    pressure: number;
    windSpeed: number;
  };
}

export class ComprehensiveReportDto {
  @ApiProperty({ description: 'Daily statistics' })
  dailyStats: DailyStatsDto;

  @ApiProperty({ description: 'Most polluted time information' })
  mostPollutedTime: MostPollutedTimeDto;

  @ApiProperty({ description: 'Historical trends', type: [HistoricalTrendDto] })
  historicalTrends: HistoricalTrendDto[];

  @ApiProperty({ description: 'Pollution patterns', type: [PollutionPatternDto] })
  pollutionPatterns: PollutionPatternDto[];

  @ApiProperty({ description: 'Summary statistics' })
  summary: {
    averageAQI: number;
    trend: 'improving' | 'worsening' | 'stable';
    dominantPollutant: string;
    unhealthyDays: number;
    totalDays: number;
  };
}

export class AnalyticsQueryDto {
  @ApiPropertyOptional({ description: 'City name' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'Country name' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'Date in YYYY-MM-DD format' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ description: 'Number of days to analyze', minimum: 1, maximum: 365 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  days?: number;

  @ApiPropertyOptional({ description: 'Analysis period', enum: ['weekly', 'monthly'] })
  @IsOptional()
  @IsEnum(['weekly', 'monthly'])
  period?: 'weekly' | 'monthly';
}

export class CacheInvalidationDto {
  @ApiProperty({ description: 'City name' })
  @IsString()
  city: string;

  @ApiProperty({ description: 'Country name' })
  @IsString()
  country: string;

  @ApiPropertyOptional({ description: 'Specific date to invalidate' })
  @IsOptional()
  @IsDateString()
  date?: string;
}

export class TopCitiesQueryDto {
  @ApiPropertyOptional({ description: 'Number of cities to return', minimum: 1, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class AnalyticsHealthDto {
  @ApiProperty({ description: 'Service health status', enum: ['healthy', 'degraded', 'unhealthy'] })
  status: 'healthy' | 'degraded' | 'unhealthy';

  @ApiProperty({ description: 'Health check timestamp' })
  timestamp: Date;

  @ApiProperty({ description: 'Service version' })
  version: string;

  @ApiProperty({ description: 'Available features' })
  features: {
    dailyStats: boolean;
    hourlyStats: boolean;
    historicalTrends: boolean;
    pollutionPatterns: boolean;
    caching: boolean;
  };
}

export class AnalyticsSummaryDto {
  @ApiProperty({ description: 'Average AQI across the period' })
  averageAQI: number;

  @ApiProperty({ description: 'Trend direction', enum: ['improving', 'worsening', 'stable'] })
  trend: 'improving' | 'worsening' | 'stable';

  @ApiProperty({ description: 'Dominant pollutant' })
  dominantPollutant: string;

  @ApiProperty({ description: 'Number of unhealthy days' })
  unhealthyDays: number;

  @ApiProperty({ description: 'Total number of days analyzed' })
  totalDays: number;

  @ApiProperty({ description: 'Data completeness percentage' })
  dataCompleteness: number;

  @ApiProperty({ description: 'Most common pollution level' })
  mostCommonPollutionLevel: string;
}

export class AnalyticsMetricsDto {
  @ApiProperty({ description: 'Total number of records processed' })
  totalRecords: number;

  @ApiProperty({ description: 'Average processing time in milliseconds' })
  averageProcessingTime: number;

  @ApiProperty({ description: 'Cache hit rate percentage' })
  cacheHitRate: number;

  @ApiProperty({ description: 'Number of successful aggregations' })
  successfulAggregations: number;

  @ApiProperty({ description: 'Number of failed aggregations' })
  failedAggregations: number;

  @ApiProperty({ description: 'Last aggregation timestamp' })
  lastAggregation: Date;
} 