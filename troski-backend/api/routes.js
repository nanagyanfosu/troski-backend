import axios from 'axios';

function formatHHMM(date, { hour12 = false, timeZone } = {}) {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12,
      timeZone, // e.g., 'Africa/Accra' if you want a fixed TZ
    }).format(date);
  } catch {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
}

export default async function handler(req, res) {
  const { origin, destination, tz, h12 } = req.query;
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
        Number.isFinite(leg?.arrival_time?.value)
          ? leg.arrival_time.value * 1000
          : Number.isFinite(durationSeconds)
            ? now.getTime() + durationSeconds * 1000
            : now.getTime();

      const arrivalTime = new Date(baseMs);

      // Preferred formatting: HH:MM with no seconds
      const text_24h = formatHHMM(arrivalTime, { hour12: false, timeZone: tz });
      const text_12h = formatHHMM(arrivalTime, { hour12: true, timeZone: tz });
      // If caller passed h12=1, use 12-hour for the default text; otherwise 24-hour
      const text = h12 === '1' ? text_12h : text_24h;

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
          text,             // strictly HH:MM (either 24h or 12h per h12 flag)
          text_24h,
          text_12h,
          timestamp: arrivalTime.getTime(),
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