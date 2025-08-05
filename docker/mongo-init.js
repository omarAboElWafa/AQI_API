// MongoDB initialization script for AQI API
// This script runs when the MongoDB container starts for the first time

// Switch to the aqi_monitoring database
db = db.getSiblingDB('aqi_monitoring');

// Create collections with proper validation
db.createCollection('airqualities', {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["city", "country", "timestamp"],
      properties: {
        city: {
          bsonType: "string",
          description: "City name - required"
        },
        state: {
          bsonType: "string",
          description: "State name"
        },
        country: {
          bsonType: "string",
          description: "Country name - required"
        },
        location: {
          bsonType: "object",
          properties: {
            type: {
              bsonType: "string",
              enum: ["Point"]
            },
            coordinates: {
              bsonType: "array",
              items: {
                bsonType: "number"
              }
            }
          }
        },
        pollution: {
          bsonType: "object",
          properties: {
            ts: { bsonType: "string" },
            aqius: { bsonType: "number" },
            mainus: { bsonType: "string" },
            aqicn: { bsonType: "number" },
            maincn: { bsonType: "string" }
          }
        },
        weather: {
          bsonType: "object",
          properties: {
            ts: { bsonType: "string" },
            tp: { bsonType: "number" },
            pr: { bsonType: "number" },
            hu: { bsonType: "number" },
            ws: { bsonType: "number" },
            wd: { bsonType: "number" },
            ic: { bsonType: "string" }
          }
        },
        timestamp: {
          bsonType: "date",
          description: "Measurement timestamp - required"
        },
        createdAt: {
          bsonType: "date"
        },
        updatedAt: {
          bsonType: "date"
        }
      }
    }
  }
});

// Create indexes for better performance
db.airqualities.createIndex({ "location": "2dsphere" });
db.airqualities.createIndex({ "city": 1, "country": 1, "timestamp": -1 });
db.airqualities.createIndex({ "timestamp": 1 });
db.airqualities.createIndex({ "createdAt": 1 });

// Create TTL index to automatically delete old data (optional - uncomment if needed)
// db.airqualities.createIndex({ "timestamp": 1 }, { expireAfterSeconds: 7776000 }); // 90 days

// Create daily aggregations collection
db.createCollection('dailyaggregations', {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["date", "city", "country"],
      properties: {
        date: {
          bsonType: "string",
          pattern: "^\\d{4}-\\d{2}-\\d{2}$"
        },
        city: {
          bsonType: "string"
        },
        country: {
          bsonType: "string"
        },
        averageAqi: {
          bsonType: "number"
        },
        minAqi: {
          bsonType: "number"
        },
        maxAqi: {
          bsonType: "number"
        },
        dominantPollutant: {
          bsonType: "string"
        },
        measurementCount: {
          bsonType: "number"
        },
        unhealthyHours: {
          bsonType: "number"
        },
        createdAt: {
          bsonType: "date"
        }
      }
    }
  }
});

// Create indexes for daily aggregations
db.dailyaggregations.createIndex({ "date": 1, "city": 1, "country": 1 }, { unique: true });
db.dailyaggregations.createIndex({ "createdAt": 1 });

// Create system collections for Bull queue
db.createCollection('bull_jobs');
db.createCollection('bull_locks');

// Create indexes for Bull collections
db.bull_jobs.createIndex({ "queue": 1, "id": 1 }, { unique: true });
db.bull_jobs.createIndex({ "queue": 1, "processedOn": 1 });
db.bull_jobs.createIndex({ "queue": 1, "delay": 1 });
db.bull_jobs.createIndex({ "queue": 1, "priority": 1 });

db.bull_locks.createIndex({ "key": 1 }, { unique: true });

// Insert initial data for Paris (optional)
db.airqualities.insertOne({
  city: "Paris",
  state: "Ile-de-France",
  country: "France",
  location: {
    type: "Point",
    coordinates: [2.352222, 48.856613]
  },
  pollution: {
    ts: new Date().toISOString(),
    aqius: 50,
    mainus: "p2",
    aqicn: 50,
    maincn: "p2"
  },
  weather: {
    ts: new Date().toISOString(),
    tp: 20,
    pr: 1013,
    hu: 60,
    ws: 3.5,
    wd: 270,
    ic: "01d"
  },
  timestamp: new Date(),
  createdAt: new Date(),
  updatedAt: new Date()
});

print("MongoDB initialization completed successfully!");
print("Database: aqi_monitoring");
print("Collections created: airqualities, dailyaggregations, bull_jobs, bull_locks");
print("Indexes created for optimal performance"); 