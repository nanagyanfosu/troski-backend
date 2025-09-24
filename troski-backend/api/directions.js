import axios from 'axios';

export default async function handler(req, res) {
  const { origin, destination } = req.query;
  if (!origin || !destination) {
    return res.status(400).json({ error: 'Missing origin or destination' });
  }
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&key=${apiKey}`;
    const response = await axios.get(url);
    res.status(200).json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    const data = err.response?.data || { error: 'Failed to fetch directions' };
    res.status(status).json(data);
  }
}
