import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AirQualityDocument = AirQuality & Document;

@Schema({ timestamps: true })
export class AirQuality {
  @Prop({ required: true })
  city: string;

  @Prop({ required: true })
  state: string;

  @Prop({ required: true })
  country: string;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  })
  location: {
    type: string;
    coordinates: [number, number];
  };

  @Prop({
    type: {
      ts: String,
      aqius: Number,
      mainus: String,
      aqicn: Number,
      maincn: String,
    },
    required: true,
  })
  pollution: {
    ts: string;
    aqius: number;
    mainus: string;
    aqicn: number;
    maincn: string;
  };

  @Prop({
    type: {
      ts: String,
      tp: Number,
      pr: Number,
      hu: Number,
      ws: Number,
      wd: Number,
      ic: String,
    },
    required: true,
  })
  weather: {
    ts: string;
    tp: number;
    pr: number;
    hu: number;
    ws: number;
    wd: number;
    ic: string;
  };

  @Prop({ required: true })
  timestamp: Date;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const AirQualitySchema = SchemaFactory.createForClass(AirQuality);

// Create geospatial index
AirQualitySchema.index({ location: '2dsphere' });

// Create compound index for efficient queries
AirQualitySchema.index({ city: 1, country: 1, timestamp: -1 });

// Create TTL index to automatically delete old data (optional)
// AirQualitySchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 }); // 90 days 