import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Param,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

import { DataMigrationService } from '../services/data-migration.service';
import {
  SmartQueryService,
  QueryResult,
} from '../services/smart-query.service';

@ApiTags('Data Management')
@Controller('data-management')
export class DataManagementController {
  constructor(
    private readonly dataMigrationService: DataMigrationService,
    private readonly smartQueryService: SmartQueryService
  ) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get collection statistics' })
  @ApiResponse({
    status: 200,
    description: 'Collection statistics retrieved successfully',
  })
  async getCollectionStats() {
    const [migrationStats, queryStats] = await Promise.all([
      this.dataMigrationService.getMigrationStats(),
      this.smartQueryService.getCollectionStats(),
    ]);

    return {
      migration: migrationStats,
      collections: queryStats,
      timestamp: new Date(),
    };
  }

  @Post('migrate')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger manual data migration' })
  @ApiResponse({
    status: 202,
    description: 'Migration job started successfully',
  })
  async triggerMigration(
    @Body()
    body: {
      fromCollection: 'hot' | 'warm';
      toCollection: 'warm' | 'cold';
      cutoffDate: string;
    }
  ) {
    const cutoffDate = new Date(body.cutoffDate);
    const result = await this.dataMigrationService.manualMigration(
      body.fromCollection,
      body.toCollection,
      cutoffDate
    );

    return {
      message: 'Migration completed',
      result,
    };
  }

  @Get('query')
  @ApiOperation({ summary: 'Smart query across all collections' })
  @ApiQuery({
    name: 'startDate',
    description: 'Start date (ISO string)',
    example: '2024-01-01T00:00:00Z',
  })
  @ApiQuery({
    name: 'endDate',
    description: 'End date (ISO string)',
    example: '2024-01-31T23:59:59Z',
  })
  @ApiQuery({
    name: 'location',
    description: 'Location filter',
    required: false,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Result limit',
    example: 100,
    required: false,
  })
  async smartQuery(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('location') location?: string,
    @Query('limit') limit?: number,
    @Query('minAqi') minAqi?: number,
    @Query('maxAqi') maxAqi?: number,
    @Query('pollutant') pollutant?: string,
    @Query('pollution_level') pollution_level?: string
  ): Promise<QueryResult> {
    const queryOptions = {
      location,
      limit: limit ? parseInt(limit.toString()) : undefined,
      minAqi: minAqi ? parseInt(minAqi.toString()) : undefined,
      maxAqi: maxAqi ? parseInt(maxAqi.toString()) : undefined,
      pollutant,
      pollution_level,
    };

    return await this.smartQueryService.getAirQualityData(
      new Date(startDate),
      new Date(endDate),
      queryOptions
    );
  }

  @Get('latest/:location')
  @ApiOperation({ summary: 'Get latest air quality data for a location' })
  @ApiResponse({
    status: 200,
    description: 'Latest air quality data retrieved successfully',
  })
  async getLatestAirQuality(@Param('location') location: string) {
    return await this.smartQueryService.getLatestAirQuality(location);
  }

  @Get('location')
  @ApiOperation({ summary: 'Get air quality data by coordinates' })
  @ApiQuery({ name: 'lat', description: 'Latitude', example: 40.7128 })
  @ApiQuery({ name: 'lng', description: 'Longitude', example: -74.006 })
  @ApiQuery({
    name: 'distance',
    description: 'Maximum distance in meters',
    example: 50000,
    required: false,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Result limit',
    example: 10,
    required: false,
  })
  async getAirQualityByLocation(
    @Query('lat') latitude: number,
    @Query('lng') longitude: number,
    @Query('distance') maxDistance?: number,
    @Query('limit') limit?: number
  ): Promise<QueryResult> {
    return await this.smartQueryService.getAirQualityByLocation(
      latitude,
      longitude,
      maxDistance || 50000,
      limit || 10
    );
  }

  @Get('timeseries/:location')
  @ApiOperation({ summary: 'Get time-series data for a location' })
  @ApiQuery({
    name: 'startDate',
    description: 'Start date (ISO string)',
    example: '2024-01-01T00:00:00Z',
  })
  @ApiQuery({
    name: 'endDate',
    description: 'End date (ISO string)',
    example: '2024-01-31T23:59:59Z',
  })
  @ApiQuery({
    name: 'interval',
    description: 'Time interval',
    example: 'daily',
    required: false,
  })
  async getTimeSeriesData(
    @Param('location') location: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('interval') interval: 'hourly' | 'daily' | 'weekly' = 'daily'
  ): Promise<QueryResult> {
    return await this.smartQueryService.getTimeSeriesData(
      location,
      new Date(startDate),
      new Date(endDate),
      interval
    );
  }

  @Post('cleanup')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Emergency cleanup of old data' })
  @ApiResponse({
    status: 202,
    description: 'Cleanup completed successfully',
  })
  async emergencyCleanup(@Body() body: { cutoffDate: string }) {
    const cutoffDate = new Date(body.cutoffDate);
    const result = await this.dataMigrationService.emergencyCleanup(cutoffDate);

    return {
      message: 'Emergency cleanup completed',
      result,
    };
  }
}
