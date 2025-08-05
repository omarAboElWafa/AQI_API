import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';

import {
  AirQualityHot,
  AirQualityHotDocument,
} from '../schemas/air-quality-hot.schema';
import {
  AirQualityWarm,
  AirQualityWarmDocument,
} from '../schemas/air-quality-warm.schema';
import {
  AirQualityCold,
  AirQualityColdDocument,
} from '../schemas/air-quality-cold.schema';

export interface MigrationStats {
  hotToWarm: {
    migrated: number;
    deleted: number;
    errors: number;
  };
  warmToCold: {
    migrated: number;
    deleted: number;
    errors: number;
  };
  timestamp: Date;
}

@Injectable()
export class DataMigrationService {
  private readonly logger = new Logger(DataMigrationService.name);

  constructor(
    @InjectModel(AirQualityHot.name)
    private hotModel: Model<AirQualityHotDocument>,
    @InjectModel(AirQualityWarm.name)
    private warmModel: Model<AirQualityWarmDocument>,
    @InjectModel(AirQualityCold.name)
    private coldModel: Model<AirQualityColdDocument>
  ) {}

  /**
   * Daily CRON: Move 30-day-old data from hot → warm
   * Runs at 2 AM daily
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async migrateHotToWarm() {
    this.logger.log('Starting hot to warm data migration...');

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const stats = { migrated: 0, deleted: 0, errors: 0 };

    try {
      // Find hot data older than 30 days
      const hotDataToMigrate = await this.hotModel
        .find({
          timestamp: { $lt: thirtyDaysAgo },
        })
        .lean();

      this.logger.log(
        `Found ${hotDataToMigrate.length} records to migrate from hot to warm`
      );

      if (hotDataToMigrate.length > 0) {
        // Batch insert to warm collection
        const warmData = hotDataToMigrate.map(record => ({
          ...record,
          _id: undefined, // Remove _id to allow MongoDB to generate new one
        }));

        await this.warmModel.insertMany(warmData);
        stats.migrated = warmData.length;

        // Delete from hot collection
        const deleteResult = await this.hotModel.deleteMany({
          timestamp: { $lt: thirtyDaysAgo },
        });
        stats.deleted = deleteResult.deletedCount;

        this.logger.log(
          `Successfully migrated ${stats.migrated} records from hot to warm collection`
        );
      }
    } catch (error) {
      stats.errors++;
      this.logger.error('Error during hot to warm migration:', error);
    }

    this.logger.log(
      `Hot to warm migration completed. Stats: ${JSON.stringify(stats)}`
    );
  }

  /**
   * Monthly CRON: Move 1-year-old data from warm → cold
   * Runs at 3 AM on the 1st of each month
   */
  @Cron('0 3 1 * *')
  async migrateWarmToCold() {
    this.logger.log('Starting warm to cold data migration...');

    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const stats = { migrated: 0, deleted: 0, errors: 0 };

    try {
      // Find warm data older than 1 year
      const warmDataToMigrate = await this.warmModel
        .find({
          timestamp: { $lt: oneYearAgo },
        })
        .lean();

      this.logger.log(
        `Found ${warmDataToMigrate.length} records to migrate from warm to cold`
      );

      if (warmDataToMigrate.length > 0) {
        // Batch insert to cold collection
        const coldData = warmDataToMigrate.map(record => ({
          ...record,
          _id: undefined, // Remove _id to allow MongoDB to generate new one
        }));

        await this.coldModel.insertMany(coldData);
        stats.migrated = coldData.length;

        // Delete from warm collection
        const deleteResult = await this.warmModel.deleteMany({
          timestamp: { $lt: oneYearAgo },
        });
        stats.deleted = deleteResult.deletedCount;

        this.logger.log(
          `Successfully migrated ${stats.migrated} records from warm to cold collection`
        );
      }
    } catch (error) {
      stats.errors++;
      this.logger.error('Error during warm to cold migration:', error);
    }

    this.logger.log(
      `Warm to cold migration completed. Stats: ${JSON.stringify(stats)}`
    );
  }

  /**
   * Manual migration method for testing or emergency migrations
   */
  async manualMigration(
    fromCollection: 'hot' | 'warm',
    toCollection: 'warm' | 'cold',
    cutoffDate: Date
  ): Promise<MigrationStats> {
    this.logger.log(
      `Manual migration: ${fromCollection} → ${toCollection}, cutoff: ${cutoffDate}`
    );

    const stats: MigrationStats = {
      hotToWarm: { migrated: 0, deleted: 0, errors: 0 },
      warmToCold: { migrated: 0, deleted: 0, errors: 0 },
      timestamp: new Date(),
    };

    try {
      let sourceModel: Model<any>;
      let targetModel: Model<any>;

      if (fromCollection === 'hot' && toCollection === 'warm') {
        sourceModel = this.hotModel;
        targetModel = this.warmModel;
      } else if (fromCollection === 'warm' && toCollection === 'cold') {
        sourceModel = this.warmModel;
        targetModel = this.coldModel;
      } else {
        throw new Error('Invalid migration path');
      }

      // Find data older than cutoff date
      const dataToMigrate = await sourceModel
        .find({
          timestamp: { $lt: cutoffDate },
        })
        .lean();

      this.logger.log(`Found ${dataToMigrate.length} records to migrate`);

      if (dataToMigrate.length > 0) {
        // Batch insert to target collection
        const targetData = dataToMigrate.map(record => ({
          ...record,
          _id: undefined,
        }));

        await targetModel.insertMany(targetData);

        // Delete from source collection
        const deleteResult = await sourceModel.deleteMany({
          timestamp: { $lt: cutoffDate },
        });

        if (fromCollection === 'hot') {
          stats.hotToWarm.migrated = targetData.length;
          stats.hotToWarm.deleted = deleteResult.deletedCount;
        } else {
          stats.warmToCold.migrated = targetData.length;
          stats.warmToCold.deleted = deleteResult.deletedCount;
        }

        this.logger.log(`Manual migration completed successfully`);
      }
    } catch (error) {
      this.logger.error('Error during manual migration:', error);
      if (fromCollection === 'hot') {
        stats.hotToWarm.errors++;
      } else {
        stats.warmToCold.errors++;
      }
    }

    return stats;
  }

  /**
   * Get migration statistics
   */
  async getMigrationStats(): Promise<{
    hot: {
      count: number;
      oldestRecord: Date | null;
      newestRecord: Date | null;
    };
    warm: {
      count: number;
      oldestRecord: Date | null;
      newestRecord: Date | null;
    };
    cold: {
      count: number;
      oldestRecord: Date | null;
      newestRecord: Date | null;
    };
  }> {
    const [hotStats, warmStats, coldStats] = await Promise.all([
      this.getCollectionStats(this.hotModel),
      this.getCollectionStats(this.warmModel),
      this.getCollectionStats(this.coldModel),
    ]);

    return {
      hot: hotStats,
      warm: warmStats,
      cold: coldStats,
    };
  }

  private async getCollectionStats(model: Model<any>) {
    const [count, oldestRecord, newestRecord] = await Promise.all([
      model.countDocuments(),
      model.findOne().sort({ timestamp: 1 }).select('timestamp'),
      model.findOne().sort({ timestamp: -1 }).select('timestamp'),
    ]);

    return {
      count,
      oldestRecord: oldestRecord?.timestamp || null,
      newestRecord: newestRecord?.timestamp || null,
    };
  }

  /**
   * Emergency cleanup method to remove old data
   */
  async emergencyCleanup(cutoffDate: Date): Promise<{
    hotDeleted: number;
    warmDeleted: number;
    coldDeleted: number;
  }> {
    this.logger.warn(
      `Emergency cleanup: Removing data older than ${cutoffDate}`
    );

    const [hotResult, warmResult, coldResult] = await Promise.all([
      this.hotModel.deleteMany({ timestamp: { $lt: cutoffDate } }),
      this.warmModel.deleteMany({ timestamp: { $lt: cutoffDate } }),
      this.coldModel.deleteMany({ timestamp: { $lt: cutoffDate } }),
    ]);

    const result = {
      hotDeleted: hotResult.deletedCount,
      warmDeleted: warmResult.deletedCount,
      coldDeleted: coldResult.deletedCount,
    };

    this.logger.log(`Emergency cleanup completed: ${JSON.stringify(result)}`);
    return result;
  }
}
