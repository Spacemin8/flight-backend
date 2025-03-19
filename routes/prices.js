const express = require('express');
const router = express.Router();

router.post('/update-prices', async (req, res) => {
  const { supabase } = req;
  const { batchSize = 10 } = req.body;

  try {
    // Fetch routes needing a price update
    const { data: routes, error: routesError } = await supabase
      .from('route_demand_tracking')
      .select('*')
      .eq('is_ignored', false)
      .gt('search_count', 30)
      .limit(batchSize);

    if (routesError) throw routesError;

    for (const route of routes) {
      try {
        // Fetch new prices from Skyscanner API
        const response = await fetch(
          `https://sky-scanner3.p.rapidapi.com/flights/price-calendar-web?fromEntityId=${route.origin}&toEntityId=${route.destination}&yearMonth=${route.year_month}&currency=EUR`,
          {
            headers: {
              'x-rapidapi-host': 'sky-scanner3.p.rapidapi.com',
              'x-rapidapi-key':
                'eff37b01a1msh6090de6dea39514p108435jsnf7c09e43a0a5'
            }
          }
        );

        const priceData = await response.json();

        // Transform API response to our price grid format
        const priceGrid = {};
        if (priceData.data?.PriceGrids?.Grid) {
          priceData.data.PriceGrids.Grid.forEach((day, index) => {
            const date = `${route.year_month}-${String(index + 1).padStart(
              2,
              '0'
            )}`;
            priceGrid[date] = {
              price: day.DirectOutbound ? day.DirectOutbound.Price : null,
              isDirect: day.DirectOutboundAvailable || false
            };
          });
        }

        // Update prices in database
        const { error: updateError } = await supabase
          .from('calendar_prices')
          .upsert(
            {
              origin: route.origin,
              destination: route.destination,
              year_month: route.year_month,
              price_grid: priceGrid,
              last_update: new Date().toISOString(),
              has_direct_flight: Object.values(priceGrid).some(
                (p) => p.isDirect
              )
            },
            { onConflict: ['origin', 'destination', 'year_month'] }
          );

        if (updateError) throw updateError;

        // Update last price update timestamp
        await supabase
          .from('route_demand_tracking')
          .update({
            last_price_update: new Date().toISOString(),
            search_count: 0,
            recent_search_count: route.recent_search_count + route.search_count
          })
          .eq('id', route.id);
      } catch (error) {
        console.error(
          `Error updating prices for route ${route.origin}-${route.destination}:`,
          error
        );
      }
    }

    res.json({
      status: 'success',
      message: `Price update batch completed for ${JSON.stringify(
        routes
      )} routes`
    });
  } catch (error) {
    console.error('Error in price update:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update prices'
    });
  }
});

module.exports = router;
