import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AirQualityRecordDocument = AirQualityRecord & Document;

@Schema({ 
  timestamps: true,
  collection: 'air_quality_records'
})
export class AirQualityRecord {
  @Prop({ 
    required: true, 
    default: 'paris',
    index: true 
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

export const AirQualityRecordSchema = SchemaFactory.createForClass(AirQualityRecord);

// Compound indexes for efficient queries
AirQualityRecordSchema.index({ location: 1, timestamp: -1 });
AirQualityRecordSchema.index({ timestamp: -1, location: 1 });
AirQualityRecordSchema.index({ 'coordinates.latitude': 1, 'coordinates.longitude': 1 });

// Geospatial index for location-based queries
AirQualityRecordSchema.index({ 
  coordinates: '2dsphere' 
});

// TTL index to automatically delete old records (optional - 90 days)
// AirQualityRecordSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 });

// Partial index for high AQI values (for alerting)
AirQualityRecordSchema.index({ 
  aqi: 1, 
  timestamp: -1 
}, { 
  partialFilterExpression: { aqi: { $gte: 100 } } 
});

// Text index for location search
AirQualityRecordSchema.index({ 
  location: 'text' 
}); 