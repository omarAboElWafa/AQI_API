import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DailyAggregationDocument = DailyAggregation & Document;

@Schema({ timestamps: true })
export class DailyAggregation {
  @Prop({ required: true })
  date: string;

  @Prop({ required: true })
  city: string;

  @Prop({ required: true })
  country: string;

  @Prop({ required: true })
  averageAQI: number;

  @Prop({ required: true })
  maxAQI: number;

  @Prop({ required: true })
  minAQI: number;

  @Prop({ required: true })
  dominantPollutant: string;

  @Prop({
    type: String,
    enum: ['Good', 'Moderate', 'Unhealthy for Sensitive Groups', 'Unhealthy', 'Very Unhealthy', 'Hazardous'],
    required: true,
  })
  pollutionLevel: 'Good' | 'Moderate' | 'Unhealthy for Sensitive Groups' | 'Unhealthy' | 'Very Unhealthy' | 'Hazardous';

  @Prop({ required: true })
  totalRecords: number;

  @Prop({
    type: [{
      hour: Number,
      averageAQI: Number,
      recordCount: Number,
    }],
    required: true,
  })
  hourlyAverages: Array<{
    hour: number;
    averageAQI: number;
    recordCount: number;
  }>;

  @Prop({
    type: [Number],
    required: true,
  })
  missingDataHours: number[];

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const DailyAggregationSchema = SchemaFactory.createForClass(DailyAggregation);

// Create compound index for efficient queries
DailyAggregationSchema.index({ city: 1, country: 1, date: -1 });

// Create index for date-based queries
DailyAggregationSchema.index({ date: -1 });

// Create index for pollution level queries
DailyAggregationSchema.index({ pollutionLevel: 1, date: -1 });

// Create TTL index to automatically delete old data (optional)
// DailyAggregationSchema.index({ date: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 }); // 1 year 