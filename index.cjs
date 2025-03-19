require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');
const { Redis } = require('@upstash/redis');

const searchRoutes = require('./routes/search');
const demandRoutes = require('./routes/demand');
const priceRoutes = require('./routes/prices');
const intervalRoutes = require('./routes/intervals');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN
});

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Inject dependencies into request
app.use((req, res, next) => {
  req.supabase = supabase;
  req.redis = redis;
  next();
});

// Routes
app.use('/api', searchRoutes);
app.use('/api', demandRoutes);
app.use('/api', priceRoutes);
app.use('/api', intervalRoutes);

// Cron Jobs
// Update demand levels daily at midnight
cron.schedule('0 0 * * *', async () => {
  try {
    const response = await fetch(`${process.env.BASE_URL}/api/update-demand`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ forceUpdate: false })
    });
    console.log('Daily demand update completed');
  } catch (error) {
    console.error('Error in demand update cron:', error);
  }
});

// Update intervals every 3 hours
cron.schedule('0 */3 * * *', async () => {
  try {
    const response = await fetch(
      `${process.env.BASE_URL}/api/update-interval`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceUpdate: false })
      }
    );
    console.log('Interval update completed');
  } catch (error) {
    console.error('Error in interval update cron:', error);
  }
});

// Check and update prices every 10 minutes
cron.schedule('*/10 * * * *', async () => {
  try {
    const response = await fetch(`${process.env.BASE_URL}/api/update-prices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchSize: 10 })
    });
    console.log('Price update batch completed');
  } catch (error) {
    console.error('Error in price update cron:', error);
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
