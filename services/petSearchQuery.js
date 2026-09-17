/**
 * Builds Amazon search keywords and match rules from a pet + store category.
 * Generic "pet supplies" queries rank dogs first, so every species gets its own phrasing.
 */

const CATEGORY_KEYS = {
    'Food & Treats': 'food',
    Toys: 'toys',
    'Beds & Furniture': 'habitat',
    'Clothing & Accessories': 'accessories',
    'Health & Grooming': 'health',
    'Training & Travel': 'travel',
    Pets: 'all',
    Other: 'all',
    All: 'all',
};

const PROFILES = {
    dog: {
        noun: 'dog',
        include: ['dog', 'puppy', 'canine', 'pup'],
        exclude: ['cat', 'kitten', 'feline', 'bird', 'parrot', 'fish', 'aquarium'],
        categories: {
            all: 'dog supplies',
            food: 'dog food',
            toys: 'dog toys',
            habitat: 'dog bed',
            accessories: 'dog clothes collar',
            health: 'dog grooming vitamins',
            travel: 'dog carrier leash',
        },
    },
    cat: {
        noun: 'cat',
        include: ['cat', 'kitten', 'feline', 'kitty'],
        exclude: ['dog', 'puppy', 'canine', 'bird', 'parrot', 'fish', 'aquarium'],
        categories: {
            all: 'cat supplies',
            food: 'cat food',
            toys: 'cat toys',
            habitat: 'cat bed tree',
            accessories: 'cat collar',
            health: 'cat litter grooming',
            travel: 'cat carrier',
        },
    },
    bird: {
        noun: 'bird',
        include: [
            'bird', 'parrot', 'parakeet', 'budgie', 'cockatiel', 'conure', 'macaw',
            'finch', 'canary', 'avian', 'cockatoo', 'lovebird', 'cockatiel', 'birdcage',
        ],
        exclude: ['dog', 'puppy', 'canine', 'cat', 'kitten', 'feline'],
        categories: {
            all: 'bird supplies parrot',
            food: 'bird food seed',
            toys: 'bird toys parrot',
            habitat: 'bird cage',
            accessories: 'bird perch swing',
            health: 'bird vitamins',
            travel: 'bird carrier',
        },
    },
    fish: {
        noun: 'fish',
        include: ['fish', 'aquarium', 'betta', 'goldfish', 'tetra', 'tank'],
        exclude: ['dog', 'cat', 'bird', 'parrot', 'puppy'],
        categories: {
            all: 'aquarium fish supplies',
            food: 'fish food',
            toys: 'aquarium decoration',
            habitat: 'fish tank aquarium',
            accessories: 'aquarium filter',
            health: 'fish water treatment',
            travel: 'fish bag aquarium',
        },
    },
    rabbit: {
        noun: 'rabbit',
        include: ['rabbit', 'bunny', 'hare'],
        exclude: ['dog', 'cat', 'bird', 'puppy'],
        categories: {
            all: 'rabbit supplies',
            food: 'rabbit food hay',
            toys: 'rabbit toys',
            habitat: 'rabbit hutch cage',
            accessories: 'rabbit litter',
            health: 'rabbit vitamins',
            travel: 'rabbit carrier',
        },
    },
    hamster: {
        noun: 'hamster',
        include: ['hamster'],
        exclude: ['dog', 'cat', 'bird', 'puppy'],
        categories: {
            all: 'hamster supplies',
            food: 'hamster food',
            toys: 'hamster wheel toys',
            habitat: 'hamster cage',
            accessories: 'hamster bedding',
            health: 'hamster vitamins',
            travel: 'hamster carrier',
        },
    },
    'guinea pig': {
        noun: 'guinea pig',
        include: ['guinea pig', 'cavy'],
        exclude: ['dog', 'cat', 'bird', 'puppy'],
        categories: {
            all: 'guinea pig supplies',
            food: 'guinea pig food hay',
            toys: 'guinea pig toys',
            habitat: 'guinea pig cage',
            accessories: 'guinea pig hideout',
            health: 'guinea pig vitamins',
            travel: 'guinea pig carrier',
        },
    },
    reptile: {
        noun: 'reptile',
        include: ['reptile', 'lizard', 'gecko', 'iguana', 'bearded dragon', 'snake', 'turtle', 'tortoise', 'terrarium'],
        exclude: ['dog', 'cat', 'bird', 'puppy', 'kitten'],
        categories: {
            all: 'reptile supplies',
            food: 'reptile food',
            toys: 'reptile hide decoration',
            habitat: 'reptile tank terrarium',
            accessories: 'reptile heat lamp',
            health: 'reptile vitamins',
            travel: 'reptile carrier',
        },
    },
    horse: {
        noun: 'horse',
        include: ['horse', 'equine', 'pony'],
        exclude: ['dog', 'cat', 'bird', 'puppy'],
        categories: {
            all: 'horse supplies',
            food: 'horse feed',
            toys: 'horse toys',
            habitat: 'horse stall',
            accessories: 'horse tack',
            health: 'horse grooming',
            travel: 'horse trailer',
        },
    },
};

const TYPE_ALIASES = {
    dog: 'dog',
    dogs: 'dog',
    puppy: 'dog',
    cat: 'cat',
    cats: 'cat',
    kitten: 'cat',
    bird: 'bird',
    birds: 'bird',
    parrot: 'bird',
    parakeet: 'bird',
    cockatiel: 'bird',
    fish: 'fish',
    rabbit: 'rabbit',
    bunny: 'rabbit',
    hamster: 'hamster',
    'guinea pig': 'guinea pig',
    turtle: 'reptile',
    tortoise: 'reptile',
    snake: 'reptile',
    lizard: 'reptile',
    gecko: 'reptile',
    iguana: 'reptile',
    'bearded dragon': 'reptile',
    frog: 'reptile',
    horse: 'horse',
    ferret: 'ferret',
    chinchilla: 'chinchilla',
    hedgehog: 'hedgehog',
    chicken: 'chicken',
    duck: 'duck',
    mouse: 'mouse',
    rat: 'rat',
    gerbil: 'gerbil',
};

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasTerm(text, term) {
    const pattern = new RegExp(`\\b${escapeRegExp(term)}s?\\b`, 'i');
    return pattern.test(text);
}

function resolveSpecies(petType) {
    const raw = String(petType || '').trim().toLowerCase();
    if (!raw || raw === 'other') return null;
    if (PROFILES[raw]) return raw;
    if (TYPE_ALIASES[raw]) return TYPE_ALIASES[raw];
    return raw;
}

function getProfile(species) {
    if (!species) return null;
    if (PROFILES[species]) return PROFILES[species];
    return {
        noun: species,
        include: [species],
        exclude: ['dog', 'puppy', 'cat', 'kitten'],
        categories: {
            all: `${species} supplies`,
            food: `${species} food`,
            toys: `${species} toys`,
            habitat: `${species} cage habitat`,
            accessories: `${species} accessories`,
            health: `${species} vitamins`,
            travel: `${species} carrier`,
        },
    };
}

function categoryKey(category) {
    if (!category || category === 'All') return 'all';
    return CATEGORY_KEYS[category] || 'all';
}

function productText(product) {
    const features = Array.isArray(product?.features) ? product.features.join(' ') : '';
    return [
        product?.title,
        product?.description,
        product?.brand,
        product?.category,
        features,
    ].filter(Boolean).join(' ').toLowerCase();
}

function scoreProduct(product, profile) {
    if (!profile) return 0;
    const text = productText(product);
    let score = 0;
    profile.include.forEach((term) => {
        if (hasTerm(text, term)) score += 4;
    });
    profile.exclude.forEach((term) => {
        if (hasTerm(text, term)) score -= 5;
    });
    return score;
}

function rankAndFilter(products, profile) {
    if (!profile || !Array.isArray(products) || products.length === 0) {
        return products || [];
    }

    const scored = products.map((product) => ({
        product,
        score: scoreProduct(product, profile),
    }));
    scored.sort((a, b) => b.score - a.score);

    const matched = scored.filter((item) => item.score > 0).map((item) => item.product);
    if (matched.length >= 6) return matched;

    const nonNegative = scored.filter((item) => item.score >= 0).map((item) => item.product);
    return nonNegative.length ? nonNegative : matched.length ? matched : products;
}

function buildPetSearch({ petType, petBreed, category, search } = {}) {
    const species = resolveSpecies(petType);
    const profile = getProfile(species);
    const catKey = categoryKey(category);
    const breed = String(petBreed || '').trim();
    const userSearch = String(search || '').trim();

    if (!profile) {
        const fallback = userSearch
            || (category && category !== 'All' ? `pet ${String(category).toLowerCase()}` : 'pet supplies');
        return {
            keyword: fallback,
            species: null,
            profile: null,
            label: 'All pets',
        };
    }

    const base = profile.categories[catKey] || profile.categories.all;
    let keyword;
    if (userSearch) {
        keyword = [breed, profile.noun, userSearch].filter(Boolean).join(' ');
    } else if (breed && !hasTerm(base, breed)) {
        keyword = `${breed} ${base}`;
    } else {
        keyword = base;
    }

    return {
        keyword: keyword.replace(/\s+/g, ' ').trim(),
        species,
        profile,
        label: breed ? `${breed} ${profile.noun}` : profile.noun,
    };
}

module.exports = {
    buildPetSearch,
    rankAndFilter,
    resolveSpecies,
    getProfile,
};
