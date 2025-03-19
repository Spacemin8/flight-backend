const express = require('express');
const router = express.Router();

router.post('/update-demand', async (req, res) => {
  const { supabase } = req;
  const { forceUpdate } = req.body;

  try {
    // Update computed demand levels
    const { error: demandError } = await supabase.rpc('update_demand_levels');

    if (demandError) throw demandError;

    res.json({
      status: 'success',
      message: 'Demand levels updated successfully'
    });
  } catch (error) {
    console.error('Error updating demand:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update demand levels'
    });
  }
});

module.exports = router;
