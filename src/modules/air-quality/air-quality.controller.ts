import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  HttpStatus,
  HttpCode,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

import { AirQualityService } from './air-quality.service';
import { GetAirQualityDto, CreateAirQualityDto, AirQualityResponseDto } from '@/common/dto/air-quality.dto';

@ApiTags('Air Quality')
@Controller('air-quality')
export class AirQualityController {
  constructor(private readonly airQualityService: AirQualityService) {}

  @Get('current')
  @ApiOperation({ summary: 'Get current air quality for a city' })
  @ApiQuery({ name: 'city', description: 'City name', example: 'New York' })
  @ApiQuery({ name: 'state', description: 'State name', example: 'New York', required: false })
  @ApiQuery({ name: 'country', description: 'Country name', example: 'USA' })
  @ApiResponse({
    status: 200,
    description: 'Current air quality data retrieved successfully',
    type: AirQualityResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Air quality data not found' })
  async getCurrentAirQuality(@Query() query: GetAirQualityDto): Promise<AirQualityResponseDto> {
    return await this.airQualityService.getLatestAirQuality(query.city, query.country);
  }

  @Get('history/:city/:country')
  @ApiOperation({ summary: 'Get air quality history for a city' })
  @ApiQuery({ name: 'limit', description: 'Number of records to return', example: 24, required: false })
  @ApiResponse({
    status: 200,
    description: 'Air quality history retrieved successfully',
    type: [AirQualityResponseDto],
  })
  async getAirQualityHistory(
    @Param('city') city: string,
    @Param('country') country: string,
    @Query('limit') limit?: number,
  ): Promise<AirQualityResponseDto[]> {
    return await this.airQualityService.getAirQualityHistory(city, country, limit);
  }

  @Get('location')
  @ApiOperation({ summary: 'Get air quality data by location coordinates' })
  @ApiQuery({ name: 'lat', description: 'Latitude', example: 40.7128 })
  @ApiQuery({ name: 'lng', description: 'Longitude', example: -74.0060 })
  @ApiQuery({ name: 'distance', description: 'Maximum distance in meters', example: 50000, required: false })
  @ApiResponse({
    status: 200,
    description: 'Air quality data by location retrieved successfully',
    type: [AirQualityResponseDto],
  })
  async getAirQualityByLocation(
    @Query('lat') latitude: number,
    @Query('lng') longitude: number,
    @Query('distance') maxDistance?: number,
  ): Promise<AirQualityResponseDto[]> {
    return await this.airQualityService.getAirQualityByLocation(latitude, longitude, maxDistance);
  }

  @Post('fetch')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger air quality data fetch for a city' })
  @ApiResponse({
    status: 202,
    description: 'Air quality data fetch queued successfully',
  })
  async fetchAirQualityData(@Body() body: GetAirQualityDto): Promise<{ message: string }> {
    await this.airQualityService.addToQueue(body.city, body.state || '', body.country);
    return { message: 'Air quality data fetch has been queued' };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new air quality record' })
  @ApiResponse({
    status: 201,
    description: 'Air quality record created successfully',
    type: AirQualityResponseDto,
  })
  async createAirQualityRecord(@Body() createDto: CreateAirQualityDto): Promise<AirQualityResponseDto> {
    const record = await this.airQualityService.createAirQualityRecord(createDto);
    return this.airQualityService.mapToResponseDto(record);
  }
} 