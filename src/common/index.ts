// DTOs
export * from './dto/air-quality.dto';
export * from './dto/air-quality-record.dto';
export * from './dto/analytics.dto';

// Interfaces
export * from './interfaces/air-quality.interface';
export * from './interfaces/iqair-api.interface';
export * from './interfaces/email-alert.interface';
export * from './interfaces/queue-job.interface';

// Types
export type PollutionLevel = 'Good' | 'Moderate' | 'Unhealthy for Sensitive Groups' | 'Unhealthy' | 'Very Unhealthy' | 'Hazardous';
export type Pollutant = 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'n2' | 's4' | 'co' | 'o3' | 'no2' | 'so2';
export type JobPriority = 'low' | 'normal' | 'high' | 'urgent';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type AlertFrequency = 'immediate' | 'hourly' | 'daily';
export type AlertLevel = 'all' | 'moderate' | 'unhealthy' | 'very_unhealthy' | 'hazardous';
export type AnalyticsPeriod = 'daily' | 'weekly' | 'monthly';
export type TrendDirection = 'improving' | 'worsening' | 'stable'; 