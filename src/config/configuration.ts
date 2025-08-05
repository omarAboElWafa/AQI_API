export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // IQAir API Configuration
  iqair: {
    apiKey: process.env.IQAIR_API_KEY,
    baseUrl: 'http://api.airvisual.com/v2',
  },
  
  // MongoDB Configuration
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/aqi_monitoring',
  },
  
  // Redis Configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  },
  
  // Bull Queue Configuration
  bull: {
    redis: {
      host: process.env.BULL_REDIS_HOST || 'localhost',
      port: parseInt(process.env.BULL_REDIS_PORT, 10) || 6379,
    },
  },
  
  // Email Configuration
  email: {
    adminEmail: process.env.ADMIN_EMAIL,
    smtp: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  },
  
  // Cache Configuration
  cache: {
    ttl: parseInt(process.env.CACHE_TTL, 10) || 3600,
  },
}); 