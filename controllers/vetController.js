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
    const dKm = R * c; // Distance in km
    const dMi = dKm * 0.621371; // Distance in miles

    if (dMi < 0.1) {
        return (dKm * 1000).toFixed(0) + ' m';
    }
    return `${dMi.toFixed(1)} miles`;
};

/**
 * Fetches additional details for a place (phone and full hours)
 */
const fetchPlaceDetails = async (placeId) => {
    try {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_phone_number,opening_hours&key=${API_KEY}`;
        const response = await axios.get(url);
        const result = response.data.result || {};

        return {
            phone: result.formatted_phone_number || 'View in Maps',
            fullHours: result.opening_hours ? result.opening_hours.weekday_text : ['Hours not available']
        };
    } catch (error) {
        console.error(`Error fetching details for ${placeId}:`, error.message);
        return { phone: 'View in Maps', fullHours: ['Hours not available'] };
    }
};

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || 'AIzaSyCnHcVmVDRCcuVQapoiVD31FgWSXc0lUkX';

/**
 * @desc    Get nearby veterinary clinics
 * @route   GET /api/vets/nearby
 * @access  Public
 */
exports.getNearbyVets = async (req, res, next) => {
    try {
        const { lat, lng, radius = 48280 } = req.query; // Default to 30 miles (48280 meters)

        let targetLat = lat ? parseFloat(lat) : 40.7128; // Default NY
        let targetLng = lng ? parseFloat(lng) : -74.0060;

        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${targetLat},${targetLng}&radius=${radius}&type=veterinary_care&key=${API_KEY}`;
        const response = await axios.get(url);

        const vets = await Promise.all(response.data.results.map(async (place) => {
            const distanceValue = lat && lng ? calculateDistance(targetLat, targetLng, place.geometry.location.lat, place.geometry.location.lng) : 'Nearby';
            const details = await fetchPlaceDetails(place.place_id);

            return {
                id: place.place_id,
                name: place.name,
                description: place.types.includes('pet_store') ? 'Pet Store & Clinic' : 'Veterinary Hospital',
                address: place.vicinity,
                distance: distanceValue,
                rating: place.rating || 0,
                phone: details.phone,
                openNow: place.opening_hours ? place.opening_hours.open_now : false,
                timings: details.fullHours.join('\n'), // Pass full weekly hours as newline separated string
                image: '🏥'
            };
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
        const { q, lat, lng } = req.query;

        if (!q) {
            return res.status(400).json({
                success: false,
                message: 'Search query is required'
            });
        }

        let targetLat = lat ? parseFloat(lat) : null;
        let targetLng = lng ? parseFloat(lng) : null;

        let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q + ' veterinary')}&type=veterinary_care&key=${API_KEY}`;
        if (targetLat && targetLng) {
            url += `&location=${targetLat},${targetLng}&radius=48280`;
        }
        const response = await axios.get(url);

        const vets = await Promise.all(response.data.results.map(async (place) => {
            const details = await fetchPlaceDetails(place.place_id);

            return {
                id: place.place_id,
                name: place.name,
                description: 'Veterinary Care Facility',
                address: place.formatted_address,
                distance: targetLat && targetLng ? calculateDistance(targetLat, targetLng, place.geometry.location.lat, place.geometry.location.lng) : 'Search Result',
                rating: place.rating || 0,
                phone: details.phone,
                openNow: place.opening_hours ? place.opening_hours.open_now : false,
                timings: details.fullHours.join('\n'),
                image: '🏥'
            };
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
