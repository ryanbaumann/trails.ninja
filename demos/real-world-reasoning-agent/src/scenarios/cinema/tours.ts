import type { LatLng } from '@/lib/types';

export interface TourStop {
  name: string;
  query?: string; // text search to fetch real facts (defaults to name)
  center: LatLng;
  altitude?: number;
  range: number;
  heading: number;
  tilt: number;
}

export interface Tour {
  id: string;
  title: string;
  subtitle: string;
  stops: TourStop[];
}

export const TOURS: Tour[] = [
  {
    id: 'sf',
    title: 'SF Icons',
    subtitle: 'Five landmarks of San Francisco',
    stops: [
      { name: 'Golden Gate Bridge', center: { lat: 37.8199, lng: -122.4783 }, altitude: 80, range: 1200, heading: 120, tilt: 68 },
      { name: 'Painted Ladies', query: 'Painted Ladies Alamo Square', center: { lat: 37.7762, lng: -122.4327 }, altitude: 40, range: 500, heading: 210, tilt: 62 },
      { name: 'Coit Tower', center: { lat: 37.8024, lng: -122.4058 }, altitude: 90, range: 700, heading: 300, tilt: 60 },
      { name: 'Ferry Building', center: { lat: 37.7955, lng: -122.3937 }, altitude: 50, range: 650, heading: 250, tilt: 60 },
      { name: 'Palace of Fine Arts', center: { lat: 37.8029, lng: -122.4484 }, altitude: 45, range: 620, heading: 160, tilt: 60 },
    ],
  },
  {
    id: 'nyc',
    title: 'Manhattan Skyline',
    subtitle: 'A flight over New York',
    stops: [
      { name: 'Statue of Liberty', center: { lat: 40.6892, lng: -74.0445 }, altitude: 60, range: 900, heading: 20, tilt: 65 },
      { name: 'One World Trade Center', center: { lat: 40.7127, lng: -74.0134 }, altitude: 240, range: 1100, heading: 200, tilt: 62 },
      { name: 'Empire State Building', center: { lat: 40.7484, lng: -73.9857 }, altitude: 260, range: 1000, heading: 220, tilt: 60 },
      { name: 'Central Park', center: { lat: 40.7812, lng: -73.9665 }, altitude: 120, range: 1600, heading: 180, tilt: 58 },
      { name: 'Brooklyn Bridge', center: { lat: 40.7061, lng: -73.9969 }, altitude: 40, range: 800, heading: 300, tilt: 66 },
    ],
  },
  {
    id: 'rome',
    title: 'Wonders of Rome',
    subtitle: 'The eternal city from above',
    stops: [
      { name: 'Colosseum', center: { lat: 41.8902, lng: 12.4922 }, altitude: 40, range: 620, heading: 250, tilt: 64 },
      { name: 'St. Peter’s Basilica', query: "St. Peter's Basilica Vatican", center: { lat: 41.9022, lng: 12.4539 }, altitude: 90, range: 900, heading: 120, tilt: 60 },
      { name: 'Pantheon', center: { lat: 41.8986, lng: 12.4769 }, altitude: 35, range: 480, heading: 200, tilt: 62 },
      { name: 'Trevi Fountain', center: { lat: 41.9009, lng: 12.4833 }, altitude: 30, range: 420, heading: 300, tilt: 60 },
      { name: 'Roman Forum', center: { lat: 41.8925, lng: 12.4853 }, altitude: 45, range: 700, heading: 150, tilt: 62 },
    ],
  },
  {
    id: 'london',
    title: 'London Highlights',
    subtitle: 'A cinematic flight over London',
    stops: [
      { name: 'Big Ben', center: { lat: 51.5007, lng: -0.1246 }, altitude: 100, range: 600, heading: 45, tilt: 60 },
      { name: 'Tower Bridge', center: { lat: 51.5055, lng: -0.0754 }, altitude: 60, range: 700, heading: 120, tilt: 65 },
      { name: 'London Eye', center: { lat: 51.5033, lng: -0.1195 }, altitude: 120, range: 800, heading: 210, tilt: 62 },
    ],
  },
  {
    id: 'tokyo',
    title: 'Tokyo Sights',
    subtitle: 'Exploring the metropolis',
    stops: [
      { name: 'Tokyo Tower', center: { lat: 35.6586, lng: 139.7454 }, altitude: 330, range: 1000, heading: 60, tilt: 65 },
      { name: 'Shibuya Crossing', center: { lat: 35.6595, lng: 139.7005 }, altitude: 50, range: 500, heading: 180, tilt: 55 },
      { name: 'Senso-ji', center: { lat: 35.7148, lng: 139.7967 }, altitude: 40, range: 450, heading: 330, tilt: 60 },
    ],
  },
  {
    id: 'paris',
    title: 'Paris Landmarks',
    subtitle: 'The city of light',
    stops: [
      { name: 'Eiffel Tower', center: { lat: 48.8584, lng: 2.2945 }, altitude: 300, range: 1200, heading: 135, tilt: 65 },
      { name: 'Louvre Museum', center: { lat: 48.8606, lng: 2.3376 }, altitude: 60, range: 800, heading: 45, tilt: 60 },
      { name: 'Arc de Triomphe', center: { lat: 48.8738, lng: 2.2950 }, altitude: 50, range: 600, heading: 270, tilt: 65 },
    ],
  },
  {
    id: 'sydney',
    title: 'Sydney Harbour',
    subtitle: 'Icons of Australia',
    stops: [
      { name: 'Sydney Opera House', center: { lat: -33.8568, lng: 151.2153 }, altitude: 65, range: 600, heading: 150, tilt: 65 },
      { name: 'Sydney Harbour Bridge', center: { lat: -33.8523, lng: 151.2108 }, altitude: 130, range: 1000, heading: 210, tilt: 60 },
      { name: 'Bondi Beach', center: { lat: -33.8915, lng: 151.2767 }, altitude: 20, range: 800, heading: 90, tilt: 50 },
    ],
  },
];

export const TOUR_BY_ID = Object.fromEntries(TOURS.map((t) => [t.id, t]));
