import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

import { AirQualityService } from './air-quality.service';
import { CreateAirQualityDto } from '@/common/dto/air-quality.dto';

interface FetchAirQualityJob {
  city: string;
  state: string;
  country: string;
}

@Processor('air-quality')
export class AirQualityProcessor {
  private readonly logger = new Logger(AirQualityProcessor.name);

  constructor(private readonly airQualityService: AirQualityService) {}

  @Process('fetch-air-quality')
  async handleFetchAirQuality(job: Job<FetchAirQualityJob>) {
    this.logger.log(`Processing air quality fetch job for ${job.data.city}, ${job.data.state}, ${job.data.country}`);

    try {
      // Fetch air quality data from IQAir API
      const airQualityData = await this.airQualityService.fetchAirQualityData(
        job.data.city,
        job.data.state,
        job.data.country,
      );

      // Create DTO for database storage
      const createDto: CreateAirQualityDto = {
        city: airQualityData.city,
        state: airQualityData.state,
        country: airQualityData.country,
        latitude: airQualityData.location.coordinates[1],
        longitude: airQualityData.location.coordinates[0],
        aqius: airQualityData.current.pollution.aqius,
        mainus: airQualityData.current.pollution.mainus,
        aqicn: airQualityData.current.pollution.aqicn,
        maincn: airQualityData.current.pollution.maincn,
        temperature: airQualityData.current.weather.tp,
        pressure: airQualityData.current.weather.pr,
        humidity: airQualityData.current.weather.hu,
        windSpeed: airQualityData.current.weather.ws,
        windDirection: airQualityData.current.weather.wd,
        weatherIcon: airQualityData.current.weather.ic,
        timestamp: airQualityData.timestamp,
      };

      // Save to database
      await this.airQualityService.createAirQualityRecord(createDto);

      this.logger.log(`Successfully processed air quality data for ${job.data.city}`);
      
      return {
        success: true,
        city: job.data.city,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to process air quality fetch job for ${job.data.city}:`, error);
      
      // Re-throw the error to mark the job as failed
      throw error;
    }
  }
} 