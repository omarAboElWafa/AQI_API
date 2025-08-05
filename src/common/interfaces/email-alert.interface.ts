export interface EmailAlert {
  id: string;
  to: string;
  subject: string;
  html: string;
  city: string;
  aqi: number;
  level: string;
  timestamp: Date;
  sent: boolean;
  sentAt?: Date;
  error?: string;
}

export interface EmailAlertTemplate {
  city: string;
  aqi: number;
  level: string;
  timestamp: Date;
  recommendations: string[];
  color: string;
}

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

export interface EmailRecipient {
  email: string;
  name?: string;
  preferences?: {
    alertLevel: 'all' | 'moderate' | 'unhealthy' | 'very_unhealthy' | 'hazardous';
    frequency: 'immediate' | 'hourly' | 'daily';
    timezone?: string;
  };
}

export interface EmailAlertJob {
  alertId: string;
  recipient: EmailRecipient;
  template: EmailAlertTemplate;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  retryCount: number;
  maxRetries: number;
}

export interface EmailAlertStats {
  totalSent: number;
  totalFailed: number;
  successRate: number;
  averageResponseTime: number;
  lastSentAt?: Date;
  lastFailedAt?: Date;
}

export interface EmailTemplate {
  name: string;
  subject: string;
  htmlTemplate: string;
  textTemplate?: string;
  variables: string[];
}

export interface AirQualityAlertThreshold {
  level: 'Good' | 'Moderate' | 'Unhealthy for Sensitive Groups' | 'Unhealthy' | 'Very Unhealthy' | 'Hazardous';
  minAqi: number;
  maxAqi: number;
  color: string;
  recommendations: string[];
} 