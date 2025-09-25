import axios from 'axios';

export default async function handler(req, res) {
  const { origin, destination } = req.query;
  if (!origin || !destination) {
    return res.status(400).json({ error: 'Missing origin or destination' });
  }
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    // Example: get multiple route alternatives from Google Directions
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&alternatives=true&departure_time=now&key=${apiKey}`;
    const response = await axios.get(url);
    // Rank routes by duration and proximity (shortest duration first)
    const routes = (response.data.routes || []).map((route, idx) => {
      const leg = route.legs?.[0];
      const durationSeconds = Number.isFinite(leg?.duration?.value) ? leg.duration.value : Infinity;
      const distanceMeters = Number.isFinite(leg?.distance?.value) ? leg.distance.value : null;
      
      // Calculate estimated arrival time
      const now = new Date();
      const arrivalTime = new Date(leg?.arrival_time?.value ? leg.arrival_time.value * 1000 : now.getTime() + durationSeconds * 1000);
      
      // Calculate traffic information
      const durationInTraffic = leg?.duration_in_traffic?.value;
      const normalDuration = leg?.duration?.value;
      const hasTraffic = durationInTraffic && normalDuration && durationInTraffic > normalDuration;
      const trafficDelay = hasTraffic ? Math.round((durationInTraffic - normalDuration) / 60) : 0;
      
      // Generate traffic message
      let trafficMessage = '';
      let trafficSeverity = 'none';
      
      if (hasTraffic) {
        if (trafficDelay <= 5) {
          trafficMessage = 'Light traffic - minimal delays expected';
          trafficSeverity = 'light';
        } else if (trafficDelay <= 15) {
          trafficMessage = `Moderate traffic - ${trafficDelay} minutes delay`;
          trafficSeverity = 'moderate';
        } else {
          trafficMessage = `Heavy traffic - ${trafficDelay} minutes delay`;
          trafficSeverity = 'heavy';
        }
      } else {
        trafficMessage = 'Clear roads - no significant delays';
        trafficSeverity = 'clear';
      }
      
      return {
        name: route.summary || `Route ${idx + 1}`,
        origin,
        destination,
        distance: leg?.distance?.text,
        distance_meters: distanceMeters,
        duration: leg?.duration?.text,
        duration_seconds: durationSeconds,
        arrival_time: {
          text: leg?.arrival_time?.text || arrivalTime.toLocaleTimeString(),
          timestamp: arrivalTime.getTime(),
          iso: arrivalTime.toISOString()
        },
        traffic: {
          has_traffic: hasTraffic,
          delay_minutes: trafficDelay,
          message: trafficMessage,
          severity: trafficSeverity,
          duration_in_traffic: leg?.duration_in_traffic?.text,
          normal_duration: leg?.duration?.text
        },
        start_location: leg?.start_location,
        end_location: leg?.end_location,
        polyline: route.overview_polyline?.points,
        ...route
      };
    });
    routes.sort((a, b) => a.duration_seconds - b.duration_seconds);
    res.status(200).json({ routes });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch routes' });
  }
}

// durationSeconds helper removed in favor of Google's numeric duration.value
