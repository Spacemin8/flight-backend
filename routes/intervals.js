const express = require('express');
const router = express.Router();

router.post('/update-interval', async (req, res) => {
  const { supabase } = req;
  const { forceUpdate } = req.body;

  try {
    const currentMonth = new Date().toISOString().slice(0, 7);

    const { error: updateError } = await supabase.rpc('update_intervals', {
      current_month: currentMonth,
      force_update: forceUpdate || false
    });

    if (updateError) throw updateError;

    res.json({
      status: 'success',
      message: 'Update intervals computed successfully'
    });
  } catch (error) {
    console.error('Error updating intervals:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update intervals'
    });
  }
});

module.exports = router;
