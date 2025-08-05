import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { IQAirApiResponse, IQAirApiError } from '@/common/interfaces/iqair-api.interface';

export interface StandardizedAirQualityData {
  location: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  timestamp: Date;
  aqi: number;
  main_pollutant: string;
  pollution_level: string;
  weather: {
    temperature: number;
    humidity: number;
  };
  metadata: {
    api_response_time: number;
    cached: boolean;
    retry_count: number;
  };
}

export interface ApiCallResult {
  success: boolean;
  data?: StandardizedAirQualityData;
  error?: string;
  responseTime: number;
  retryCount: number;
}

@Injectable()
export class IQAirApiService {
  private readonly logger = new Logger(IQAirApiService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number = 10000; // 10 seconds
  private readonly maxRetries: number = 5;
  private readonly baseDelay: number = 30000; // 30 seconds

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('iqair.apiKey');
    this.baseUrl = this.configService.get<string>('iqair.baseUrl') || 'http://api.airvisual.com/v2';
    
    if (!this.apiKey) {
      this.logger.error('IQAir API key not configured. Please set IQAIR_API_KEY environment variable.');
      throw new Error('IQAir API key is required');
    }

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'User-Agent': 'AQI-Monitor/1.0.0',
        'Accept': 'application/json',
      },
    });

    // Add request interceptor for logging
    this.axiosInstance.interceptors.request.use(
      (config) => {
        this.logger.debug(`Making API request to: ${config.url}`);
        return config;
      },
      (error) => {
        this.logger.error('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.axiosInstance.interceptors.response.use(
      (response) => {
        this.logger.debug(`API response received with status: ${response.status}`);
        return response;
      },
      (error) => {
        this.logger.error(`API response error: ${error.response?.status} - ${error.message}`);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Fetch air quality data for Paris with exponential retry logic
   */
  async fetchParisAirQuality(): Promise<ApiCallResult> {
    return this.fetchAirQualityWithRetry('Paris', 'Ile-de-France', 'France');
  }

  /**
   * Fetch air quality data for any city with exponential retry logic
   */
  async fetchCityAirQuality(city: string, state: string, country: string): Promise<ApiCallResult> {
    return this.fetchAirQualityWithRetry(city, state, country);
  }

  /**
   * Fetch air quality data with exponential retry logic
   */
  private async fetchAirQualityWithRetry(
    city: string,
    state: string,
    country: string,
    attempt: number = 0
  ): Promise<ApiCallResult> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`Fetching air quality data for ${city}, ${state}, ${country} (attempt ${attempt + 1}/${this.maxRetries + 1})`);
      
      const response = await this.makeApiCall(city, state, country);
      const responseTime = Date.now() - startTime;
      
      if (response.data.status === 'success') {
        const standardizedData = this.standardizeApiResponse(response.data, responseTime, attempt);
        
        this.logger.log(`Successfully fetched air quality data for ${city} in ${responseTime}ms`);
        
        return {
          success: true,
          data: standardizedData,
          responseTime,
          retryCount: attempt,
        };
      } else {
        throw new Error(`API returned non-success status: ${response.data.status}`);
      }

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      this.logger.error(`API call failed for ${city} (attempt ${attempt + 1}):`, error.message);
      
      // Check if we should retry
      if (attempt < this.maxRetries && this.shouldRetry(error)) {
        const delay = this.calculateRetryDelay(attempt);
        
        this.logger.warn(`Retrying in ${delay}ms (attempt ${attempt + 2}/${this.maxRetries + 1})`);
        
        await this.sleep(delay);
        return this.fetchAirQualityWithRetry(city, state, country, attempt + 1);
      }
      
      // Max retries reached or non-retryable error
      this.logger.error(`Failed to fetch air quality data for ${city} after ${attempt + 1} attempts`);
      
      return {
        success: false,
        error: error.message,
        responseTime,
        retryCount: attempt,
      };
    }
  }

  /**
   * Make the actual API call
   */
  private async makeApiCall(city: string, state: string, country: string): Promise<AxiosResponse<IQAirApiResponse>> {
    const params = {
      city,
      state,
      country,
      key: this.apiKey,
    };

    return await this.axiosInstance.get('/city', { params });
  }

  /**
   * Standardize the API response into our internal format
   */
  private standardizeApiResponse(
    apiResponse: IQAirApiResponse,
    responseTime: number,
    retryCount: number
  ): StandardizedAirQualityData {
    const { data } = apiResponse;
    
    return {
      location: `${data.city}, ${data.state}, ${data.country}`,
      coordinates: {
        latitude: data.location.coordinates[1],
        longitude: data.location.coordinates[0],
      },
      timestamp: new Date(),
      aqi: data.current.pollution.aqius,
      main_pollutant: data.current.pollution.mainus,
      pollution_level: this.getAirQualityLevel(data.current.pollution.aqius),
      weather: {
        temperature: data.current.weather.tp,
        humidity: data.current.weather.hu,
      },
      metadata: {
        api_response_time: responseTime,
        cached: false,
        retry_count: retryCount,
      },
    };
  }

  /**
   * Determine if the error is retryable
   */
  private shouldRetry(error: any): boolean {
    // Retry on network errors, timeout, and certain HTTP status codes
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return true;
    }

    if (error.response?.status) {
      const status = error.response.status;
      // Retry on server errors (5xx) and rate limiting (429)
      return status >= 500 || status === 429 || status === 408;
    }

    return false;
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateRetryDelay(attempt: number): number {
    // Exponential backoff: 30s, 60s, 120s, 240s, 480s
    const delay = this.baseDelay * Math.pow(2, attempt);
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay; // ±10% jitter
    
    return Math.floor(delay + jitter);
  }

  /**
   * Sleep utility function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Convert AQI number to air quality level
   */
  private getAirQualityLevel(aqi: number): string {
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Moderate';
    if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
    if (aqi <= 200) return 'Unhealthy';
    if (aqi <= 300) return 'Very Unhealthy';
    return 'Hazardous';
  }

  /**
   * Get API service health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'unhealthy';
    apiKey: boolean;
    lastSuccessfulCall?: Date;
    totalCalls: number;
    successRate: number;
  }> {
    // This would typically be stored in Redis or database
    return {
      status: this.apiKey ? 'healthy' : 'unhealthy',
      apiKey: !!this.apiKey,
      totalCalls: 0, // Would be tracked in production
      successRate: 0, // Would be calculated from stored metrics
    };
  }

  /**
   * Validate API response structure
   */
  private validateApiResponse(response: any): boolean {
    try {
      return (
        response &&
        response.status === 'success' &&
        response.data &&
        response.data.current &&
        response.data.current.pollution &&
        typeof response.data.current.pollution.aqius === 'number' &&
        response.data.current.weather &&
        typeof response.data.current.weather.tp === 'number'
      );
    } catch (error) {
      this.logger.error('Invalid API response structure:', error);
      return false;
    }
  }

  /**
   * Get API rate limit information
   */
  async getRateLimitInfo(): Promise<{
    limit: number;
    remaining: number;
    resetTime: Date;
  }> {
    // This would be implemented based on IQAir's rate limiting headers
    // For now, return default values
    return {
      limit: 10000,
      remaining: 9999,
      resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    };
  }
} 