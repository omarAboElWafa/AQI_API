import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AirQualityColdDocument = AirQualityCold & Document;

@Schema({ 
  timestamps: true,
  collection: 'air_quality_cold'
})
export class AirQualityCold {
  @Prop({ 
    required: true, 
    default: 'paris'
  })
  location: string;

  @Prop({
    type: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },
    required: true,
  })
  coordinates: {
    latitude: number;
    longitude: number;
  };

  @Prop({ 
    required: true, 
    index: true,
    type: Date 
  })
  timestamp: Date;

  @Prop({ 
    required: true,
    min: 0,
    max: 500 
  })
  aqi: number;

  @Prop({ 
    required: true,
    enum: ['p1', 'p2', 'p3', 'p4', 'p5', 'n2', 's4', 'co', 'o3', 'no2', 'so2']
  })
  main_pollutant: string;

  @Prop({ 
    required: true,
    enum: ['Good', 'Moderate', 'Unhealthy for Sensitive Groups', 'Unhealthy', 'Very Unhealthy', 'Hazardous']
  })
  pollution_level: string;

  @Prop({
    type: {
      temperature: { type: Number, required: true },
      humidity: { type: Number, required: true, min: 0, max: 100 },
    },
    required: true,
  })
  weather: {
    temperature: number;
    humidity: number;
  };

  @Prop({
    type: {
      api_response_time: { type: Number, default: 0 },
      cached: { type: Boolean, default: false },
      retry_count: { type: Number, default: 0, min: 0 },
    },
    default: {
      api_response_time: 0,
      cached: false,
      retry_count: 0,
    },
  })
  metadata: {
    api_response_time: number;
    cached: boolean;
    retry_count: number;
  };

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const AirQualityColdSchema = SchemaFactory.createForClass(AirQualityCold);

// Minimal indexing for cold data (archival)
AirQualityColdSchema.index({ timestamp: -1 }); // Only essential index

// No TTL - Permanent storage 