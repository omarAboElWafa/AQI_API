// Common type definitions for the air quality monitoring system

export type PollutionLevel =
  | 'Good'
  | 'Moderate'
  | 'Unhealthy for Sensitive Groups'
  | 'Unhealthy'
  | 'Very Unhealthy'
  | 'Hazardous';

export type Pollutant =
  | 'p1'
  | 'p2'
  | 'p3'
  | 'p4'
  | 'p5'
  | 'n2'
  | 's4'
  | 'co'
  | 'o3'
  | 'no2'
  | 'so2';

export type JobPriority = 'low' | 'normal' | 'high' | 'urgent';

export type JobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type AlertFrequency = 'immediate' | 'hourly' | 'daily';

export type AlertLevel =
  | 'all'
  | 'moderate'
  | 'unhealthy'
  | 'very_unhealthy'
  | 'hazardous';

export type AnalyticsPeriod = 'daily' | 'weekly' | 'monthly';

export type TrendDirection = 'improving' | 'worsening' | 'stable';

export type WeatherCondition =
  | 'clear'
  | 'cloudy'
  | 'rainy'
  | 'snowy'
  | 'foggy'
  | 'stormy';

export type AirQualityStatus =
  | 'excellent'
  | 'good'
  | 'moderate'
  | 'poor'
  | 'very_poor'
  | 'hazardous';

export type DataSource = 'iqair' | 'manual' | 'sensor' | 'aggregated';

export type CacheStrategy = 'memory' | 'redis' | 'database';

export type NotificationChannel = 'email' | 'sms' | 'push' | 'webhook';

export type TimeRange = '1h' | '6h' | '12h' | '24h' | '7d' | '30d' | '90d';

export type AggregationType =
  | 'average'
  | 'min'
  | 'max'
  | 'median'
  | 'percentile';

export type SortOrder = 'asc' | 'desc';

export type FilterOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'nin'
  | 'regex';

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: SortOrder;
}

export interface FilterOptions {
  field: string;
  operator: FilterOperator;
  value: any;
}

export interface QueryOptions {
  pagination?: PaginationOptions;
  filters?: FilterOptions[];
  select?: string[];
  populate?: string[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: Date;
  requestId?: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
