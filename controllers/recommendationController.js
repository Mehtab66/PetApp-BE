const recommendationService = require('../services/recommendationService');
const { getConditionKeys, getConditionConfig } = require('../services/conditionCatalog');

/**
 * @desc    Condition-based Amazon affiliate recommendations (Creators API)
 * @route   GET /api/recommendations?condition={conditionKey}&species={optional}
 * @access  Private
 */
exports.getRecommendations = async (req, res) => {
    const { condition, petType, species } = req.query;
    const speciesHint = petType || species;

    if (!condition) {
        return res.status(400).json({
            success: false,
            message: `Please provide a condition key. Valid keys: ${getConditionKeys().join(', ')}`,
            data: [],
        });
    }

    try {
        const result = await recommendationService.getRecommendations(condition, speciesHint);
        const meta = getConditionConfig(result.condition);

        return res.status(200).json({
            success: true,
            condition: result.condition,
            title: meta?.title || result.condition,
            cached: result.cached,
            cacheTtlSeconds: result.cacheTtlSeconds,
            data: result.products,
        });
    } catch (error) {
        const status = error.statusCode || 500;

        if (error.retryAfterMs) {
            res.set('Retry-After', String(Math.ceil(error.retryAfterMs / 1000)));
        }

        console.error('[RECOMMENDATIONS]', error.message);

        return res.status(status).json({
            success: false,
            message: error.message || 'Failed to fetch recommendations',
            data: [],
        });
    }
};
