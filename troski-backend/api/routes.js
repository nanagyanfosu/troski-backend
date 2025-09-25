import axios from 'axios';

export default async function handler(req, res) {
  const { origin, destination } = req.query;
  if (!origin || !destination) {
    return res.status(400).json({ error: 'Missing origin or destination' });
  }
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&alternatives=true&departure_time=now&key=${apiKey}`;
    const response = await axios.get(url);

    const routes = (response.data.routes || []).map((route, idx) => {
      const leg = route.legs?.[0];

      const durationSeconds = Number.isFinite(leg?.duration?.value) ? leg.duration.value : null;
      const distanceMeters = Number.isFinite(leg?.distance?.value) ? leg.distance.value : null;

      const now = new Date();
      const baseMs =
        leg?.arrival_time?.value
          ? leg.arrival_time.value * 1000
          : durationSeconds != null
            ? now.getTime() + durationSeconds * 1000
            : now.getTime();

      const arrivalTime = new Date(baseMs);
      const hh = String(arrivalTime.getHours()).padStart(2, '0');
      const mm = String(arrivalTime.getMinutes()).padStart(2, '0');
      const arrivalHHMM = `${hh}:${mm}`;

      const durationInTraffic = leg?.duration_in_traffic?.value;
      const normalDuration = leg?.duration?.value;
      const hasTraffic = Number.isFinite(durationInTraffic) && Number.isFinite(normalDuration) && durationInTraffic > normalDuration;
      const trafficDelay = hasTraffic ? Math.round((durationInTraffic - normalDuration) / 60) : 0;

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
        duration_seconds: Number.isFinite(leg?.duration?.value) ? leg.duration.value : null,
        arrival_time: {
          text: arrivalHHMM,              // strictly HH:MM
          timestamp: arrivalTime.getTime(), // ms epoch (kept for compatibility)
          iso: arrivalTime.toISOString()
        },
        traffic: {
          has_traffic: !!hasTraffic,
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

    routes.sort((a, b) => (a.duration_seconds ?? Infinity) - (b.duration_seconds ?? Infinity));
    res.status(200).json({ routes });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch routes' });
  }
}