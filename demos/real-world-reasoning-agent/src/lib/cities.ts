/**
 * City presets for the demo. Each city defines the map starting point, fleet
 * depots, demand-seeding centers, and per-scenario suggested prompts so the
 * entire experience feels native to the selected city.
 */
import type { LatLng, ScenarioId } from './types';

export interface CityPreset {
  id: string;
  name: string;
  /** Short label shown in the selector. */
  label: string;
  country: string;
  emoji: string;
  center: LatLng;
  zoom: number;
  /** Fleet depots — four real-ish locations spread across the city. */
  fleetDepots: LatLng[];
  /** Three centers for seeding delivery demand via nearby search. */
  demandCenters: LatLng[];
  /** Fallback demand field if Places search fails (center + jitter radius). */
  demandFallback: LatLng;
  /** Suggested prompts keyed by scenario. */
  suggestions: Record<ScenarioId, string[]>;
}

export const CITIES: CityPreset[] = [
  {
    id: 'sf',
    name: 'San Francisco',
    label: 'San Francisco',
    country: 'US',
    emoji: '🌉',
    center: { lat: 37.7955, lng: -122.3937 },
    zoom: 13.2,
    fleetDepots: [
      { lat: 37.7956, lng: -122.3934 }, // Ferry Building
      { lat: 37.7749, lng: -122.4194 }, // Civic Center
      { lat: 37.8003, lng: -122.4116 }, // North Beach
      { lat: 37.7699, lng: -122.4269 }, // Duboce
    ],
    demandCenters: [
      { lat: 37.7929, lng: -122.4079 },
      { lat: 37.7749, lng: -122.4194 },
      { lat: 37.7999, lng: -122.4137 },
    ],
    demandFallback: { lat: 37.788, lng: -122.41 },
    suggestions: {
      concierge: [
        'Plan me a perfect Saturday near the Ferry Building — coffee, art, golden-hour dinner, all walkable',
        "It's raining — build my best indoor day downtown and show me the route",
        'Design a romantic North Beach evening and paint it as a postcard',
      ],
      insight: [
        'Give me the verdict on living near Dolores Park — with receipts',
        'Would rooftop solar pay off at the Salesforce Tower? Show the signals',
        'Hayes Valley vs the Marina: judge them on air, commute, and weather',
      ],
      fleet: [
        'Traffic just spiked — which van still hits the Marina on time?',
        'Assign the closest van to the oldest job and show your reasoning',
        'Reroute everything around the Embarcadero for the next hour',
      ],
      cinema: [
        'Fly the San Francisco icons tour',
        'Take me to the Golden Gate Bridge and tell me its story',
        'Film Rome for me — narrate what you can prove',
      ],
      adstudio: [
        'Turn Blue Bottle at the Ferry Building into a rainy-day campaign',
        'Story-format ad for a Mission taqueria, targeted to a 15-minute walk',
        'Bold poster campaign for a Union Square boutique hotel — ship it',
      ],
      scout: [
        'Find the winning corner for an espresso bar in North Beach — defend the pick',
        'Which Valencia St storefront wins on visibility? Walk it and show me',
        'Site-select a flagship on the Embarcadero and rank every candidate',
      ],
    },
  },
  {
    id: 'nyc',
    name: 'New York City',
    label: 'New York',
    country: 'US',
    emoji: '🗽',
    center: { lat: 40.7580, lng: -73.9855 },
    zoom: 13,
    fleetDepots: [
      { lat: 40.7484, lng: -73.9857 }, // Midtown (Empire State)
      { lat: 40.7128, lng: -74.0060 }, // Financial District
      { lat: 40.7282, lng: -73.7949 }, // Queens (Jamaica)
      { lat: 40.6892, lng: -73.9857 }, // South Brooklyn
    ],
    demandCenters: [
      { lat: 40.7580, lng: -73.9855 },
      { lat: 40.7282, lng: -73.9942 },
      { lat: 40.7411, lng: -73.9897 },
    ],
    demandFallback: { lat: 40.745, lng: -73.99 },
    suggestions: {
      concierge: [
        'Plan me a perfect Saturday in SoHo — brunch, galleries, rooftop dinner, all walkable',
        "It's raining — build my best indoor day in Midtown and show me the route",
        'Design a romantic West Village evening and paint it as a postcard',
      ],
      insight: [
        'Give me the verdict on living near Washington Square Park — with receipts',
        'Would rooftop solar pay off at Hudson Yards? Show the signals',
        'Upper West Side vs Williamsburg: judge them on air, commute, and weather',
      ],
      fleet: [
        'Traffic just spiked — which van still hits Times Square on time?',
        'Assign the closest van to the oldest job and show your reasoning',
        'Reroute everything around the FDR Drive for the next hour',
      ],
      cinema: [
        'Fly the New York icons tour',
        'Take me to the Statue of Liberty and tell me its story',
        'Film Rome for me — narrate what you can prove',
      ],
      adstudio: [
        'Turn a coffee shop near Grand Central into a rainy-day campaign',
        'Story-format ad for an East Village pizzeria, targeted to a 15-minute walk',
        'Bold poster campaign for a Times Square boutique hotel — ship it',
      ],
      scout: [
        'Find the winning corner for an espresso bar in the West Village — defend the pick',
        'Which SoHo Broadway storefront wins on visibility? Walk it and show me',
        'Site-select a flagship on Fifth Avenue and rank every candidate',
      ],
    },
  },
  {
    id: 'london',
    name: 'London',
    label: 'London',
    country: 'UK',
    emoji: '🇬🇧',
    center: { lat: 51.5074, lng: -0.1278 },
    zoom: 13,
    fleetDepots: [
      { lat: 51.5074, lng: -0.1278 }, // Covent Garden
      { lat: 51.5155, lng: -0.1420 }, // Soho
      { lat: 51.5033, lng: -0.1195 }, // Southbank
      { lat: 51.5194, lng: -0.0727 }, // Shoreditch
    ],
    demandCenters: [
      { lat: 51.5074, lng: -0.1278 },
      { lat: 51.5155, lng: -0.1420 },
      { lat: 51.5194, lng: -0.0727 },
    ],
    demandFallback: { lat: 51.512, lng: -0.12 },
    suggestions: {
      concierge: [
        'Plan me a perfect Saturday in Covent Garden — coffee, a museum, Thames-view dinner, all walkable',
        "It's raining — build my best indoor day in central London and show me the route",
        'Design a romantic Soho evening and paint it as a postcard',
      ],
      insight: [
        'Give me the verdict on living near Hyde Park — with receipts',
        'Would rooftop solar pay off at Canary Wharf? Show the signals',
        'Shoreditch vs Notting Hill: judge them on air, commute, and weather',
      ],
      fleet: [
        'Traffic just spiked — which van still hits Piccadilly Circus on time?',
        'Assign the closest van to the oldest job and show your reasoning',
        'Reroute everything around London Bridge for the next hour',
      ],
      cinema: [
        'Fly the London icons tour',
        'Take me to Tower Bridge and tell me its story',
        'Film Rome for me — narrate what you can prove',
      ],
      adstudio: [
        'Turn a café in Notting Hill into a rainy-day campaign',
        'Story-format ad for a Soho restaurant, targeted to a 15-minute walk',
        'Bold poster campaign for a Covent Garden boutique hotel — ship it',
      ],
      scout: [
        'Find the winning corner for a coffee shop in Shoreditch — defend the pick',
        'Which Oxford Street storefront wins on visibility? Walk it and show me',
        'Site-select a flagship on the South Bank and rank every candidate',
      ],
    },
  },
  {
    id: 'tokyo',
    name: 'Tokyo',
    label: 'Tokyo',
    country: 'JP',
    emoji: '🗼',
    center: { lat: 35.6762, lng: 139.6503 },
    zoom: 12.5,
    fleetDepots: [
      { lat: 35.6812, lng: 139.7671 }, // Tokyo Station
      { lat: 35.6595, lng: 139.7004 }, // Shibuya
      { lat: 35.6938, lng: 139.7034 }, // Shinjuku
      { lat: 35.7100, lng: 139.8107 }, // Asakusa
    ],
    demandCenters: [
      { lat: 35.6812, lng: 139.7671 },
      { lat: 35.6595, lng: 139.7004 },
      { lat: 35.6938, lng: 139.7034 },
    ],
    demandFallback: { lat: 35.685, lng: 139.75 },
    suggestions: {
      concierge: [
        'Plan me a perfect Saturday in Shibuya — kissaten coffee, Meiji Shrine, sunset ramen, all walkable',
        "It's raining — build my best indoor day in Shinjuku and show me the route",
        'Design a romantic Ginza evening and paint it as a postcard',
      ],
      insight: [
        'Give me the verdict on living near Yoyogi Park — with receipts',
        'Would rooftop solar pay off at Tokyo Tower? Show the signals',
        'Shimokitazawa vs Nakameguro: judge them on air, commute, and weather',
      ],
      fleet: [
        'Traffic just spiked — which van still hits Shibuya on time?',
        'Assign the closest van to the oldest job and show your reasoning',
        'Reroute everything around the Shuto Expressway for the next hour',
      ],
      cinema: [
        'Fly the Tokyo icons tour',
        'Take me to Tokyo Tower and tell me its story',
        'Film Rome for me — narrate what you can prove',
      ],
      adstudio: [
        'Turn a ramen shop near Shinjuku Station into a rainy-day campaign',
        'Story-format ad for a Tsukiji sushi bar, targeted to a 15-minute walk',
        'Bold poster campaign for a Roppongi boutique hotel — ship it',
      ],
      scout: [
        'Find the winning corner for a café in Shimokitazawa — defend the pick',
        'Which Omotesando storefront wins on visibility? Walk it and show me',
        'Site-select a flagship on Takeshita Street and rank every candidate',
      ],
    },
  },
  {
    id: 'paris',
    name: 'Paris',
    label: 'Paris',
    country: 'FR',
    emoji: '🗼',
    center: { lat: 48.8566, lng: 2.3522 },
    zoom: 13,
    fleetDepots: [
      { lat: 48.8606, lng: 2.3376 }, // Louvre
      { lat: 48.8530, lng: 2.3499 }, // Saint-Germain
      { lat: 48.8566, lng: 2.3522 }, // Île de la Cité
      { lat: 48.8738, lng: 2.2950 }, // Arc de Triomphe
    ],
    demandCenters: [
      { lat: 48.8606, lng: 2.3376 },
      { lat: 48.8530, lng: 2.3499 },
      { lat: 48.8738, lng: 2.2950 },
    ],
    demandFallback: { lat: 48.858, lng: 2.345 },
    suggestions: {
      concierge: [
        'Plan me a perfect Saturday in Le Marais — pâtisserie, a gallery, sunset Seine dinner, all walkable',
        "It's raining — build my best indoor day near Saint-Germain and show me the route",
        'Design a romantic Montmartre evening and paint it as a postcard',
      ],
      insight: [
        'Give me the verdict on living near the Luxembourg Gardens — with receipts',
        'Would rooftop solar pay off at La Défense? Show the signals',
        'Le Marais vs the 16th: judge them on air, commute, and weather',
      ],
      fleet: [
        'Traffic just spiked — which van still hits the Eiffel Tower on time?',
        'Assign the closest van to the oldest job and show your reasoning',
        'Reroute everything around the Champs-Élysées for the next hour',
      ],
      cinema: [
        'Fly the Paris icons tour',
        'Take me to the Eiffel Tower and tell me its story',
        'Film Rome for me — narrate what you can prove',
      ],
      adstudio: [
        'Turn a pâtisserie in Le Marais into a rainy-day campaign',
        'Story-format ad for a Saint-Germain bistro, targeted to a 15-minute walk',
        'Bold poster campaign for an Opéra boutique hotel — ship it',
      ],
      scout: [
        'Find the winning corner for a café near Canal Saint-Martin — defend the pick',
        'Which Rue de Rivoli storefront wins on visibility? Walk it and show me',
        'Site-select a flagship on the Champs-Élysées and rank every candidate',
      ],
    },
  },
  {
    id: 'sydney',
    name: 'Sydney',
    label: 'Sydney',
    country: 'AU',
    emoji: '🇦🇺',
    center: { lat: -33.8688, lng: 151.2093 },
    zoom: 13,
    fleetDepots: [
      { lat: -33.8568, lng: 151.2153 }, // Circular Quay
      { lat: -33.8708, lng: 151.2073 }, // Town Hall
      { lat: -33.8830, lng: 151.2120 }, // Surry Hills
      { lat: -33.8523, lng: 151.2108 }, // The Rocks
    ],
    demandCenters: [
      { lat: -33.8568, lng: 151.2153 },
      { lat: -33.8708, lng: 151.2073 },
      { lat: -33.8830, lng: 151.2120 },
    ],
    demandFallback: { lat: -33.865, lng: 151.21 },
    suggestions: {
      concierge: [
        'Plan me a perfect Saturday around Circular Quay — flat white, the gallery, harbour dinner, all walkable',
        "It's raining — build my best indoor day in the CBD and show me the route",
        'Design a romantic Surry Hills evening and paint it as a postcard',
      ],
      insight: [
        'Give me the verdict on living near the Royal Botanic Garden — with receipts',
        'Would rooftop solar pay off at Darling Harbour? Show the signals',
        'Surry Hills vs Bondi Beach: judge them on air, commute, and weather',
      ],
      fleet: [
        'Traffic just spiked — which van still hits the Opera House on time?',
        'Assign the closest van to the oldest job and show your reasoning',
        'Reroute everything around the Harbour Bridge for the next hour',
      ],
      cinema: [
        'Fly the Sydney icons tour',
        'Take me to the Sydney Opera House and tell me its story',
        'Film Rome for me — narrate what you can prove',
      ],
      adstudio: [
        'Turn a café in The Rocks into a rainy-day campaign',
        'Story-format ad for a Surry Hills restaurant, targeted to a 15-minute walk',
        'Bold poster campaign for a Darling Harbour boutique hotel — ship it',
      ],
      scout: [
        'Find the winning corner for a coffee shop in Newtown — defend the pick',
        'Which George Street storefront wins on visibility? Walk it and show me',
        'Site-select a flagship on the Circular Quay promenade and rank every candidate',
      ],
    },
  },
];

export const CITY_BY_ID = Object.fromEntries(CITIES.map((c) => [c.id, c])) as Record<string, CityPreset>;

export const DEFAULT_CITY_ID = 'sf';
export const DEFAULT_CITY_PRESET = CITY_BY_ID[DEFAULT_CITY_ID];

export function createCustomCityPreset(name: string, country: string, center: LatLng): CityPreset {
  // Generate 4 fleet depots around center
  const fleetDepots = [
    { lat: center.lat + 0.005, lng: center.lng - 0.005 },
    { lat: center.lat - 0.005, lng: center.lng + 0.005 },
    { lat: center.lat + 0.008, lng: center.lng + 0.008 },
    { lat: center.lat - 0.008, lng: center.lng - 0.008 },
  ];
  // Generate 3 demand centers
  const demandCenters = [
    { lat: center.lat + 0.002, lng: center.lng - 0.002 },
    { lat: center.lat - 0.002, lng: center.lng + 0.002 },
    { lat: center.lat, lng: center.lng },
  ];

  return {
    id: 'user-city',
    name,
    label: name,
    country,
    emoji: '📍',
    center,
    zoom: 13,
    fleetDepots,
    demandCenters,
    demandFallback: center,
    suggestions: {
      concierge: [
        `Plan me a perfect Saturday in ${name} — coffee, a museum, golden-hour dinner, all walkable`,
        `It's raining — build my best indoor day in ${name} and show me the route`,
        `Design a romantic evening in ${name} and paint it as a postcard`,
      ],
      insight: [
        `Give me the verdict on living in central ${name} — with receipts`,
        `Would rooftop solar pay off in central ${name}? Show the signals`,
        `Compare two parts of ${name}: judge them on air, commute, and weather`,
      ],
      fleet: [
        `Traffic just spiked — which van still hits central ${name} on time?`,
        'Assign the closest van to the oldest job and show your reasoning',
        'Reroute everything around the main avenue for the next hour',
      ],
      cinema: [
        `Fly the ${name} icons tour`,
        `Take me to downtown ${name} and tell me its story`,
        'Film Rome for me — narrate what you can prove',
      ],
      adstudio: [
        `Turn a local business in ${name} into a rainy-day campaign`,
        `Story-format ad for a ${name} restaurant, targeted to a 15-minute walk`,
        `Bold poster campaign for a ${name} boutique hotel — ship it`,
      ],
      scout: [
        `Find the winning corner for a café in ${name} — defend the pick`,
        `Which ${name} storefront wins on visibility? Walk it and show me`,
        `Site-select a flagship in ${name} and rank every candidate`,
      ],
    },
  };
}
