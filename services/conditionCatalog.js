/**
 * Maps app health condition keys to Creators API SearchItems queries.
 *
 * Assumptions (edit these to match your real conditions list):
 * - Marketplace: www.amazon.com (USD) via CREATORS_MARKETPLACE
 * - SearchIndex: PetSupplies on amazon.com
 * - Keywords are US-English product searches, optionally prefixed with pet type
 * - Flea/tick season is treated as a Northern Hemisphere Apr–Oct flag on the client
 */
const CONDITION_CATALOG = {
    weight_gain: {
        keywords: 'weight management food',
        searchIndex: 'PetSupplies',
        title: 'Weight management picks',
    },
    dental_issue: {
        keywords: 'dental chews toothpaste',
        searchIndex: 'PetSupplies',
        title: 'Dental care picks',
    },
    low_activity: {
        keywords: 'interactive puzzle toys enrichment',
        searchIndex: 'PetSupplies',
        title: 'Activity & enrichment picks',
    },
    senior_joint_care: {
        keywords: 'senior joint supplement glucosamine',
        searchIndex: 'PetSupplies',
        title: 'Senior joint care picks',
    },
    flea_tick_season: {
        keywords: 'flea tick prevention treatment',
        searchIndex: 'PetSupplies',
        title: 'Flea & tick season picks',
    },
    skin_allergy: {
        keywords: 'allergy skin care oatmeal shampoo',
        searchIndex: 'PetSupplies',
        title: 'Skin & allergy picks',
    },
};

function getConditionKeys() {
    return Object.keys(CONDITION_CATALOG);
}

function getConditionConfig(conditionKey) {
    if (!conditionKey) return null;
    return CONDITION_CATALOG[String(conditionKey).trim()] || null;
}

function buildKeywords(conditionKey, petType) {
    const config = getConditionConfig(conditionKey);
    if (!config) return null;

    const type = (petType || '').trim();
    if (!type || type.toLowerCase() === 'other') {
        return config.keywords;
    }

    return `${type} ${config.keywords}`;
}

module.exports = {
    CONDITION_CATALOG,
    getConditionKeys,
    getConditionConfig,
    buildKeywords,
};
