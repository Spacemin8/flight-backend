const express = require('express');
const router = express.Router();

router.post('/track-search', async (req, res) => {
  const { origin, destination, year_month } = req.body;
  const { supabase } = req;

  try {
    // Update route_demand_tracking table
    const { data, error } = await supabase.from('route_demand_tracking').upsert(
      {
        origin,
        destination,
        year_month,
        search_count: supabase.sql`search_count + 1`,
        recent_search_count: supabase.sql`recent_search_count + 1`,
        last_search_at: new Date().toISOString(),
        is_ignored: false
      },
      {
        onConflict: 'origin,destination,year_month'
      }
    );

    if (error) throw error;

    res.json({
      status: 'success',
      message: 'Search recorded successfully'
    });
  } catch (error) {
    console.error('Error tracking search:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to record search'
    });
  }
});

module.exports = router;
