import axios from 'axios';

export default async function handler(req, res) {
  const { origin, destination } = req.query;
  if (!origin || !destination) {
    return res.status(400).json({ error: 'Missing origin or destination' });
  }
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    // Example: get multiple route alternatives from Google Directions
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&alternatives=true&key=${apiKey}`;
    const response = await axios.get(url);
    // Rank routes by duration and proximity (shortest duration first)
    const routes = (response.data.routes || []).map((route, idx) => {
      const leg = route.legs?.[0];
      const durationSeconds = Number.isFinite(leg?.duration?.value) ? leg.duration.value : Infinity;
      const distanceMeters = Number.isFinite(leg?.distance?.value) ? leg.distance.value : null;
      return {
        name: route.summary || `Route ${idx + 1}`,
        origin,
        destination,
        distance: leg?.distance?.text,
        distance_meters: distanceMeters,
        duration: leg?.duration?.text,
        duration_seconds: durationSeconds,
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
