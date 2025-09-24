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
    const routes = (response.data.routes || []).map((route, idx) => ({
      name: route.summary || `Route ${idx + 1}`,
      origin,
      destination,
      distance: route.legs[0]?.distance?.text,
      duration: route.legs[0]?.duration?.text,
      start_location: route.legs[0]?.start_location,
      end_location: route.legs[0]?.end_location,
      polyline: route.overview_polyline?.points,
      ...route
    }));
    routes.sort((a, b) => {
      // Sort by duration (in seconds if available)
      const aSec = routeDurationSeconds(a.duration);
      const bSec = routeDurationSeconds(b.duration);
      return aSec - bSec;
    });
    res.status(200).json({ routes });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch routes' });
  }
}

// Helper to convert duration string (e.g. '15 mins') to seconds
function routeDurationSeconds(duration) {
  if (!duration) return Infinity;
  const match = duration.match(/(\d+)/);
  return match ? parseInt(match[1], 10) * 60 : Infinity;
}
