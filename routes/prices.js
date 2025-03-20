const express = require('express');
const router = express.Router();

function processGridData(grid, yearMonth) {
  const priceGrid = {};
  let hasDirectFlight = false;

  // Validate grid structure
  if (!Array.isArray(grid) || grid.length === 0 || !Array.isArray(grid[0])) {
    console.warn('Invalid grid format received');
    return { priceGrid, hasDirectFlight };
  }

  // Process each day's data
  grid[0].forEach((dayData, index) => {
    // Skip if no data for this day
    if (!dayData) return;

    const day = (index + 1).toString().padStart(2, '0');
    const date = `${yearMonth}-${day}`;

    try {
      // Check for direct flights first
      if (
        dayData.DirectOutboundAvailable === true &&
        dayData.DirectOutbound &&
        typeof dayData.DirectOutbound.Price === 'number' &&
        dayData.DirectOutbound.Price > 0
      ) {
        hasDirectFlight = true;
        priceGrid[date] = {
          price: dayData.DirectOutbound.Price,
          isDirect: true
        };
        console.log(
          `Found direct flight for ${date}:`,
          dayData.DirectOutbound.Price
        );
      }
      // Check for indirect flights with Direct price
      else if (
        dayData.Direct &&
        typeof dayData.Direct.Price === 'number' &&
        dayData.Direct.Price > 0
      ) {
        priceGrid[date] = {
          price: dayData.Direct.Price,
          isDirect: false
        };
        console.log(
          `Found indirect flight (Direct) for ${date}:`,
          dayData.Direct.Price
        );
      }
      // Check for indirect flights with Indirect price
      else if (
        dayData.Indirect &&
        typeof dayData.Indirect.Price === 'number' &&
        dayData.Indirect.Price > 0
      ) {
        priceGrid[date] = {
          price: dayData.Indirect.Price,
          isDirect: false
        };
        console.log(
          `Found indirect flight (Indirect) for ${date}:`,
          dayData.Indirect.Price
        );
      }
    } catch (err) {
      console.warn(`Error processing price for ${date}:`, err);
    }
  });

  // Log summary
  console.log('Processed grid data:', {
    totalDays: Object.keys(priceGrid).length,
    directFlights: Object.values(priceGrid).filter((p) => p.isDirect).length,
    indirectFlights: Object.values(priceGrid).filter((p) => !p.isDirect).length,
    hasDirectFlight
  });

  return { priceGrid, hasDirectFlight };
}

router.post('/update-prices', async (req, res) => {
  const { supabase } = req;
  const { batchSize = 10 } = req.body;

  try {
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

        const { priceGrid, hasDirectFlight } = processGridData(
          priceData.data.PriceGrids.Grid,
          route.year_month
        );

        console.log(priceGrid);

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
              has_direct_flight: hasDirectFlight
            },
            { onConflict: 'origin,destination,year_month' }
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
