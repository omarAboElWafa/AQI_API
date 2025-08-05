# Air Quality Monitoring API

A comprehensive NestJS backend application for monitoring air quality data using the IQAir API. This system provides real-time air quality monitoring, data storage, analytics, and alert notifications.

## Features

- 🌬️ Real-time air quality data fetching from IQAir API
- 📊 MongoDB data storage with geospatial indexing
- 🔄 Background job processing with BullMQ
- 📧 Email notifications for air quality alerts
- 📈 Analytics and reporting capabilities
- 🗄️ Redis caching for improved performance
- ⏰ Scheduled tasks for automated data collection
- 🚀 RESTful API with comprehensive documentation

## Tech Stack

- **Framework**: NestJS with TypeScript
- **Database**: MongoDB with Mongoose ODM
- **Cache**: Redis with cache-manager
- **Queue**: BullMQ for background job processing
- **Email**: Nodemailer for SMTP notifications
- **HTTP Client**: Axios for API calls
- **Validation**: class-validator and class-transformer
- **Scheduling**: @nestjs/schedule for CRON jobs

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or cloud instance)
- Redis (local or cloud instance)
- IQAir API key (sign up at [IQAir](https://www.iqair.com/))

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

3. **Environment Configuration**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` file with your configuration:
   ```env
   # Application
   NODE_ENV=development
   PORT=3000

   # IQAir API Configuration
   IQAIR_API_KEY=your_iqair_api_key_here

   # MongoDB Configuration
   MONGODB_URI=mongodb://localhost:27017/aqi_monitoring

   # Redis Configuration
   REDIS_HOST=localhost
   REDIS_PORT=6379

   # Email Configuration
   ADMIN_EMAIL=admin@example.com
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=your_app_password

   # Bull Queue Configuration
   BULL_REDIS_HOST=localhost
   BULL_REDIS_PORT=6379

   # Cache Configuration
   CACHE_TTL=3600
   ```

4. **Start the application**
   ```bash
   # Development mode
   npm run start:dev

   # Production mode
   npm run build
   npm run start:prod
   ```

## API Endpoints

### Air Quality Endpoints

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

#### Trigger Air Quality Data Fetch
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

## Background Jobs

The application uses BullMQ for background job processing:

- **Air Quality Fetch Jobs**: Automatically fetch air quality data from IQAir API
- **Email Alert Jobs**: Send email notifications for air quality alerts
- **Analytics Jobs**: Generate reports and analytics data

## Scheduled Tasks

The application includes scheduled tasks for automated operations:

- Daily air quality data collection
- Weekly analytics report generation
- Email alert monitoring

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

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Application environment | `development` |
| `PORT` | Application port | `3000` |
| `IQAIR_API_KEY` | IQAir API key | Required |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/aqi_monitoring` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `ADMIN_EMAIL` | Admin email for alerts | Required |
| `SMTP_HOST` | SMTP server host | Required |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_USER` | SMTP username | Required |
| `SMTP_PASS` | SMTP password | Required |
| `BULL_REDIS_HOST` | Bull queue Redis host | `localhost` |
| `BULL_REDIS_PORT` | Bull queue Redis port | `6379` |
| `CACHE_TTL` | Cache TTL in seconds | `3600` |

## Development

### Available Scripts

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

### Project Structure

```
src/
├── modules/
│   ├── air-quality/          # Air quality data management
│   ├── database/             # Database configuration
│   ├── queue/                # Background job queues
│   ├── notifications/        # Email notifications
│   └── analytics/            # Data analytics
├── common/
│   ├── dto/                  # Data Transfer Objects
│   ├── interfaces/           # TypeScript interfaces
│   └── utils/                # Utility functions
├── config/                   # Configuration files
├── app.module.ts            # Main application module
└── main.ts                  # Application entry point
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 