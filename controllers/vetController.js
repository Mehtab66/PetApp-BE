const axios = require('axios');

/**
 * Calculates distance between two points using Haversine formula
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d < 1 ? (d * 1000).toFixed(0) + ' m' : d.toFixed(1) + ' km';
};

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || 'AIzaSyCnHcVmVDRCcuVQapoiVD31FgWSXc0lUkX';

/**
 * @desc    Get nearby veterinary clinics
 * @route   GET /api/vets/nearby
 * @access  Public
 */
exports.getNearbyVets = async (req, res, next) => {
    try {
        const { lat, lng, radius = 5000 } = req.query;

        let targetLat = lat ? parseFloat(lat) : 40.7128; // Default NY
        let targetLng = lng ? parseFloat(lng) : -74.0060;

        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${targetLat},${targetLng}&radius=${radius}&type=veterinary_care&key=${API_KEY}`;
        const response = await axios.get(url);

        const vets = response.data.results.map(place => ({
            id: place.place_id,
            name: place.name,
            description: place.types.includes('pet_store') ? 'Pet Store & Clinic' : 'Veterinary Hospital',
            address: place.vicinity,
            distance: lat && lng ? calculateDistance(targetLat, targetLng, place.geometry.location.lat, place.geometry.location.lng) : 'Nearby',
            rating: place.rating || 0,
            phone: 'View in Maps', // Searching doesn't give phone
            openNow: place.opening_hours ? place.opening_hours.open_now : false,
            image: '🏥'
        }));

        res.status(200).json({
            success: true,
            data: { vets }
        });
    } catch (error) {
        console.error('Fetch Nearby Vets Error:', error.message);
        next(error);
    }
};

/**
 * @desc    Search veterinary clinics by query (area)
 * @route   GET /api/vets/search
 * @access  Public
 */
exports.searchVets = async (req, res, next) => {
    try {
        const { q } = req.query;

        if (!q) {
            return res.status(400).json({
                success: false,
                message: 'Search query is required'
            });
        }

        const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q + ' veterinary')}&type=veterinary_care&key=${API_KEY}`;
        const response = await axios.get(url);

        const vets = response.data.results.map(place => ({
            id: place.place_id,
            name: place.name,
            description: 'Veterinary Care Facility',
            address: place.formatted_address,
            distance: 'Search Result',
            rating: place.rating || 0,
            phone: 'View in Maps',
            openNow: place.opening_hours ? place.opening_hours.open_now : false,
            image: '🏥'
        }));

        res.status(200).json({
            success: true,
            data: { vets }
        });
    } catch (error) {
        console.error('Search Vets Error:', error.message);
        next(error);
    }
};
