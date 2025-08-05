import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DailyAggregationDocument = DailyAggregation & Document;

@Schema({ 
  timestamps: true,
  collection: 'daily_aggregations'
})
export class DailyAggregation {
  @Prop({ 
    required: true,
    unique: true,
    index: true,
    match: /^\d{4}-\d{2}-\d{2}$/ // YYYY-MM-DD format validation
  })
  date: string;

  @Prop({ 
    required: true,
    index: true 
  })
  location: string;

  @Prop({
    type: {
      avg_aqi: { type: Number, required: true, min: 0, max: 500 },
      peak_aqi: {
        value: { type: Number, required: true, min: 0, max: 500 },
        time: { type: String, required: true }
      },
      min_aqi: {
        value: { type: Number, required: true, min: 0, max: 500 },
        time: { type: String, required: true }
      },
      dominant_pollutant: { type: String, required: true },
      pollution_level_distribution: { type: Object, required: true }
    },
    required: true,
  })
  daily_stats: {
    avg_aqi: number;
    peak_aqi: {
      value: number;
      time: string;
    };
    min_aqi: {
      value: number;
      time: string;
    };
    dominant_pollutant: string;
    pollution_level_distribution: Record<string, number>;
  };

  @Prop({
    type: [{
      hour: { type: Number, required: true, min: 0, max: 23 },
      avg_aqi: { type: Number, required: true, min: 0, max: 500 }
    }],
    required: true,
    validate: {
      validator: function(hourly_averages: Array<{ hour: number; avg_aqi: number }>) {
        return hourly_averages.length === 24;
      },
      message: 'Hourly averages must contain exactly 24 entries (0-23 hours)'
    }
  })
  hourly_averages: Array<{
    hour: number;
    avg_aqi: number;
  }>;

  @Prop({ 
    required: true,
    type: Date,
    default: Date.now 
  })
  calculated_at: Date;

  @Prop({ 
    required: true,
    min: 0,
    type: Number 
  })
  record_count: number;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const DailyAggregationSchema = SchemaFactory.createForClass(DailyAggregation);

// Compound indexes for efficient analytics queries
DailyAggregationSchema.index({ location: 1, date: -1 });
DailyAggregationSchema.index({ date: -1, location: 1 });

// Index for date range queries
DailyAggregationSchema.index({ date: 1 });

// Index for high AQI days (for alerting)
DailyAggregationSchema.index({ 
  'daily_stats.avg_aqi': -1, 
  date: -1 
}, { 
  partialFilterExpression: { 'daily_stats.avg_aqi': { $gte: 100 } } 
});

// Text index for location search in analytics
DailyAggregationSchema.index({ 
  location: 'text' 
});

// Ensure unique combination of date and location
DailyAggregationSchema.index({ 
  date: 1, 
  location: 1 
}, { 
  unique: true 
}); 