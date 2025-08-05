Here is your cleaned-up version of the **Air Quality Monitoring API** documentation, with all emojis removed:

---

# Air Quality Monitoring API

A comprehensive NestJS backend application for monitoring air quality data using the IQAir API. This system provides real-time air quality monitoring, data storage, analytics, and alert notifications.

---

## Features

* Real-time air quality data fetching from IQAir API
* MongoDB data storage with geospatial indexing
* Background job processing with BullMQ
* Email notifications for air quality alerts
* Analytics and reporting capabilities
* Redis caching for improved performance
* Scheduled tasks for automated data collection
* RESTful API with comprehensive documentation

---

## Tech Stack

* **Framework**: NestJS with TypeScript
* **Database**: MongoDB with Mongoose ODM
* **Cache**: Redis with cache-manager
* **Queue**: BullMQ for background job processing
* **Email**: Nodemailer for SMTP notifications
* **HTTP Client**: Axios for API calls
* **Validation**: class-validator and class-transformer
* **Scheduling**: @nestjs/schedule for CRON jobs

---

## Prerequisites

* Node.js (v16 or higher)
* MongoDB (local or cloud instance)
* Redis (local or cloud instance)
* IQAir API key ([IQAir](https://www.iqair.com/))

---

## Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd AQI_API
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment configuration**

   ```bash
   cp env.example .env
   ```

   Update `.env`:

   ```env
   NODE_ENV=development
   PORT=3000
   IQAIR_API_KEY=your_iqair_api_key_here
   MONGODB_URI=mongodb://localhost:27017/aqi_monitoring
   REDIS_HOST=localhost
   REDIS_PORT=6379
   ADMIN_EMAIL=admin@example.com
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=your_app_password
   BULL_REDIS_HOST=localhost
   BULL_REDIS_PORT=6379
   CACHE_TTL=3600
   ```

4. **Start the application**

   ```bash
   # Development
   npm run start:dev

   # Production
   npm run build
   npm run start:prod
   ```

---

## API Endpoints

### Air Quality

#### Get Current Air Quality

```http
GET /api/v1/air-quality/current?city=New York&state=New York&country=USA
```

#### Get Air Quality History

```http
GET /api/v1/air-quality/history/New York/USA?limit=24
```

#### Get Air Quality by Location

```http
GET /api/v1/air-quality/location?lat=40.7128&lng=-74.0060&distance=50000
```

#### Trigger Data Fetch

```http
POST /api/v1/air-quality/fetch
Content-Type: application/json

{
  "city": "New York",
  "state": "New York",
  "country": "USA"
}
```

#### Create Air Quality Record

```http
POST /api/v1/air-quality
Content-Type: application/json

{
  "city": "New York",
  "state": "New York",
  "country": "USA",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "aqius": 45,
  "mainus": "p2",
  "aqicn": 45,
  "maincn": "p2",
  "temperature": 20,
  "pressure": 1013,
  "humidity": 65,
  "windSpeed": 5,
  "windDirection": 180,
  "weatherIcon": "01d",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

---

## Background Jobs

The application uses BullMQ for:

* Fetching air quality data
* Sending alert notifications
* Generating analytics and reports

---

## Scheduled Tasks

Includes:

* Daily data collection
* Weekly analytics generation
* Email alert monitoring

---

## Data Models

### Air Quality Schema

```typescript
{
  city: string;
  state: string;
  country: string;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  pollution: {
    ts: string;
    aqius: number;
    mainus: string;
    aqicn: number;
    maincn: string;
  };
  weather: {
    ts: string;
    tp: number;
    pr: number;
    hu: number;
    ws: number;
    wd: number;
    ic: string;
  };
  timestamp: Date;
}
```

---

## Environment Variables

| Variable          | Description             | Default                                   |
| ----------------- | ----------------------- | ----------------------------------------- |
| `NODE_ENV`        | Application environment | development                               |
| `PORT`            | Port                    | 3000                                      |
| `IQAIR_API_KEY`   | IQAir API key           | Required                                  |
| `MONGODB_URI`     | MongoDB URI             | mongodb://localhost:27017/aqi\_monitoring |
| `REDIS_HOST`      | Redis host              | localhost                                 |
| `REDIS_PORT`      | Redis port              | 6379                                      |
| `ADMIN_EMAIL`     | Admin email             | Required                                  |
| `SMTP_HOST`       | SMTP server             | Required                                  |
| `SMTP_PORT`       | SMTP port               | 587                                       |
| `SMTP_USER`       | SMTP username           | Required                                  |
| `SMTP_PASS`       | SMTP password           | Required                                  |
| `BULL_REDIS_HOST` | Bull queue Redis host   | localhost                                 |
| `BULL_REDIS_PORT` | Bull queue Redis port   | 6379                                      |
| `CACHE_TTL`       | Cache TTL in seconds    | 3600                                      |

---

## Development

### Scripts

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod

# Testing
npm run test
npm run test:watch
npm run test:cov

# Linting
npm run lint

# Formatting
npm run format
```

---

### Project Structure

```
src/
├── modules/
│   ├── air-quality/       # Air quality data
│   ├── database/          # DB setup
│   ├── queue/             # Background jobs
│   ├── notifications/     # Email alerts
│   └── analytics/         # Reporting
├── common/
│   ├── dto/               # Data transfer objects
│   ├── interfaces/        # Shared interfaces
│   └── utils/             # Helpers
├── config/                # Config files
├── app.module.ts          # Main module
└── main.ts                # Entry point
```

---

## Contributing

1. Fork the repo
2. Create a new branch
3. Commit your changes
4. Add relevant tests
5. Open a pull request

---

## License

Licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
