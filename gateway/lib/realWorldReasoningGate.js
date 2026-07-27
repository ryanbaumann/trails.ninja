const exactKeys = (value, allowed) =>
  value !== null
  && typeof value === 'object'
  && !Array.isArray(value)
  && Object.keys(value).every((key) => allowed.includes(key));

const finite = (value, min, max) =>
  typeof value === 'number'
  && Number.isFinite(value)
  && value >= min
  && value <= max;

const shortString = (value, max = 500) =>
  typeof value === 'string'
  && value.length > 0
  && value.length <= max;

export function validateGroundingLiteCall(request) {
  if (
    !exactKeys(request, ['jsonrpc', 'id', 'method', 'params'])
    || request.jsonrpc !== '2.0'
    || request.method !== 'tools/call'
    || !exactKeys(request.params, ['name', 'arguments'])
  ) return false;

  const { name, arguments: args } = request.params;
  if (name === 'search_places') {
    if (
      !exactKeys(args, ['text_query', 'location_bias', 'language_code', 'region_code'])
      || !shortString(args.text_query)
      || args.text_query.trim().length < 4
    ) return false;
    if (args.language_code !== undefined && !/^[a-z]{2}(?:_[A-Z]{2})?$/.test(args.language_code)) return false;
    if (args.region_code !== undefined && !/^[A-Z]{2}$/.test(args.region_code)) return false;
    if (args.location_bias === undefined) return true;

    const circle = args.location_bias?.circle;
    const center = circle?.center;
    return exactKeys(args.location_bias, ['circle'])
      && exactKeys(circle, ['center', 'radius_meters'])
      && exactKeys(center, ['latitude', 'longitude'])
      && finite(center.latitude, -90, 90)
      && finite(center.longitude, -180, 180)
      && (circle.radius_meters === undefined || finite(circle.radius_meters, 1, 50_000));
  }

  if (name === 'compute_routes') {
    const point = args?.origin?.lat_lng;
    return exactKeys(args, ['origin', 'destination', 'travel_mode'])
      && exactKeys(args.origin, ['lat_lng'])
      && exactKeys(point, ['latitude', 'longitude'])
      && finite(point.latitude, -90, 90)
      && finite(point.longitude, -180, 180)
      && exactKeys(args.destination, ['place_id'])
      && shortString(args.destination.place_id, 256)
      && (args.travel_mode === 'WALK' || args.travel_mode === 'DRIVE');
  }

  if (name === 'lookup_weather') {
    return exactKeys(args, ['location', 'units_system'])
      && exactKeys(args.location, ['place_id'])
      && shortString(args.location.place_id, 256)
      && (args.units_system === 'METRIC' || args.units_system === 'IMPERIAL');
  }

  return false;
}
