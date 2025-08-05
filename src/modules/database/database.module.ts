import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: async () => ({
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/aqi_monitoring',
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }),
    }),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {} 