import axios from 'axios';

export default async function handler(req, res) {
  const { origin, destination } = req.query;
  if (!origin || !destination) {
    return res.status(400).json({ error: 'Missing origin or destination' });
  }
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&departure_time=now&key=${apiKey}`;
    const response = await axios.get(url);
    
    // Add arrival time and traffic info to the response
    const data = response.data;
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const leg = route.legs?.[0];
      
      if (leg) {
        const now = new Date();
        const arrivalTime = new Date(leg?.arrival_time?.value ? leg.arrival_time.value * 1000 : now.getTime() + (leg?.duration?.value || 0) * 1000);
        
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
        
        // Add arrival time info to the route
        route.arrival_time = {
          text: leg?.arrival_time?.text || arrivalTime.toLocaleTimeString(),
          timestamp: arrivalTime.getTime(),
          iso: arrivalTime.toISOString()
        };
        
        // Add traffic info to the route
        route.traffic = {
          has_traffic: hasTraffic,
          delay_minutes: trafficDelay,
          message: trafficMessage,
          severity: trafficSeverity,
          duration_in_traffic: leg?.duration_in_traffic?.text,
          normal_duration: leg?.duration?.text
        };
      }
    }
    
    res.status(200).json(data);
  } catch (err) {
    const status = err.response?.status || 500;
    const data = err.response?.data || { error: 'Failed to fetch directions' };
    res.status(status).json(data);
  }
}
