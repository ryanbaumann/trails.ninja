Directory structure:
└── node-strava-node-strava-v3/
    ├── README.md
    ├── axiosUtility.js
    ├── index.d.ts
    ├── index.js
    ├── LICENSE
    ├── package.json
    ├── strava_config
    ├── .drone.yml
    ├── .travis.yml
    ├── lib/
    │   ├── activities.js
    │   ├── athlete.js
    │   ├── athletes.js
    │   ├── authenticator.js
    │   ├── clubs.js
    │   ├── gear.js
    │   ├── httpClient.js
    │   ├── oauth.js
    │   ├── pushSubscriptions.js
    │   ├── rateLimiting.js
    │   ├── routes.js
    │   ├── runningRaces.js
    │   ├── segmentEfforts.js
    │   ├── segments.js
    │   ├── streams.js
    │   └── uploads.js
    ├── scripts/
    │   └── generate-access-token.js
    └── test/
        ├── _helper.js
        ├── activities.js
        ├── athlete.js
        ├── athletes.js
        ├── authenticator.js
        ├── client.js
        ├── clubs.js
        ├── config.js
        ├── gear.js
        ├── oauth.js
        ├── pushSubscriptions.js
        ├── rateLimiting.js
        ├── routes.js
        ├── runningRaces.js
        ├── segmentEfforts.js
        ├── segments.js
        ├── streams.js
        ├── uploads.js
        └── assets/
            └── gpx_sample.gpx


Files Content:

================================================
FILE: README.md
================================================

# strava-v3: Simple Node wrapper for Strava's v3 API

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![Build Status][travis-image]][travis-url]

[npm-image]: https://img.shields.io/npm/v/strava-v3.svg?style=flat
[npm-url]: https://npmjs.org/package/strava-v3
[downloads-image]: https://img.shields.io/npm/dm/strava-v3.svg?style=flat
[downloads-url]: https://npmjs.org/package/strava-v3
[travis-image]: https://travis-ci.org/UnbounDev/node-strava-v3.svg?branch=master&style=flat
[travis-url]: https://travis-ci.org/UnbounDev/node-strava-v3

### Status

Supports many but not all Strava API endpoints:

* `oauth`
* `athlete`
* `athletes`
* `activities`
* `clubs`
* `gear`
* `running_races`
* `routes`
* `segments`
* `segment_efforts`
* `streams`
* `uploads`

## Installation

```bash
npm install strava-v3
```

## Import syntax
Importing only the library:
```
import strava from 'strava-v3';
```
Importing both the library as well as interfaces:
```
import { default as strava, Strava } from 'strava-v3';
```

## Quick start

* Create an application at [strava.com/settings/api](https://www.strava.com/settings/api) and make note of your `access_token`

### Promise API

```js
const strava = require('strava-v3')
strava.config({...})
const payload = await strava.athlete.get({})
console.log(payload)
```

### Callback API (Deprecated)

```js
const strava = require('strava-v3');
strava.athlete.get({},function(err,payload,limits) {
    if(!err) {
        console.log(payload);
    }
    else {
        console.log(err);
    }
});
```

## Usage

### OAuth configuration

If you are writing an app that other Strava users will authorize against their
own account, you'll need to use the OAuth flow. This requires that you provide
a `client_id`, `client_secret` and `redirect_uri` that ultimately result in
getting back an `access_token` which can be used for calls on behalf of that
user.

You have three options to configure your OAuth calls:

#### Explicit configuration

Use explicit configuration, which will override both the config file and the environment variables:

```js
var strava = require('strava-v3')
strava.config({
  "access_token"  : "Your apps access token (Required for Quickstart)",
  "client_id"     : "Your apps Client ID (Required for oauth)",
  "client_secret" : "Your apps Client Secret (Required for oauth)",
  "redirect_uri"  : "Your apps Authorization Redirection URI (Required for oauth)",
});
```
##### Environment variables

You may alternatively supply the values via environment variables named following the convention `STRAVA_<keyName>`, so

- `STRAVA_ACCESS_TOKEN` = `access_token`
- `STRAVA_CLIENT_ID` = `client_id`
- `STRAVA_CLIENT_SECRET` = `client_secret`
- `STRAVA_REDIRECT_URI` = `redirect_uri`


#### Config File (Deprecated)

The template `strava_config` file can be found at the modules root directory and has the following structure

```json
{
  "access_token"  : "Your apps access token (Required for Quickstart)",
  "client_id"     : "Your apps Client ID (Required for oauth)",
  "client_secret" : "Your apps Client Secret (Required for oauth)",
  "redirect_uri"  : "Your apps Authorization Redirection URI (Required for oauth)",
}
```

### General

API access is designed to be as closely similar in layout as possible to Strava's own architecture, with the general call definition being

```js
var strava = require('strava-v3')

// Promise API
strava.<api endpoint>.<api endpoint option>(args)

// Callback API
strava.<api endpoint>.<api endpoint option>(args,callback)
```

Example usage:

```js
var strava = require('strava-v3');
strava.athletes.get({id:12345},function(err,payload,limits) {
    //do something with your payload, track rate limits
});
```

### Overriding the default `access_token`

You'll may want to use OAuth `access_token`s on behalf of specific users once
your app is in production. Using an `access_token` specific to a validated user
allows for detailed athlete information, as well as the option for additional
`PUT`/`POST`/`DELETE` privileges.

Use app-specific logic to retrieve the `access\_token` for a particular user, then create a Strava client for that user, with their token:

```js
const stravaApi = require('strava-v3');

// ... get access_token from somewhere
strava = new stravaApi.client(access_token);

const payload = await strava.athlete.get({})
```

Less conveniently, you can also explictly pass an `access_token` to API calls:

Example usage:

```js
const strava = require('strava-v3');
const payload = await strava.athlete.get({'access_token':'abcde'})
```

### Dealing with pagination

For those API calls that support pagination, you can control both the `page` being retrieved and the number of responses to return `per_page` by adding the corresponding properties to `args`.

Example usage:

```js
const strava = require('strava-v3');
const payload = await strava.athlete.listFollowers({
    page: 1,
    per_page: 2
});
```

### Uploading files
To upload a file you'll have to pass in the `data_type` as specified in Strava's API reference as well as a string `file` designating the `<filepath>/<filename>`. If you want to get updates on the status of your upload pass in `statusCallback` along with the rest of your `args` - the wrapper will check on the upload once a second until complete.

Example usage:

```js
const strava = require('strava-v3');
const payload = await strava.uploads.post({
    data_type: 'gpx',
    file: 'data/your_file.gpx',
    name: 'Epic times',
    statusCallback: (err,payload) => {
        //do something with your payload
    }
});
```

### Rate limits
According to Strava's API each response contains information about rate limits.
For more details see: [Rate Limits](https://developers.strava.com/docs/rate-limits/)

Returns `null` if `X-Ratelimit-Limit` or `X-RateLimit-Usage` headers are not provided

#### Global status

In our promise API, only the response body "payload" value is returned as a
[Bluebird promise](https://bluebirdjs.com/docs/api-reference.html). To track
rate limiting we use a global counter accessible through `strava.rateLimiting`.
 The rate limiting status is updated with each request.


    // returns true if the most recent request exceeded the rate limit
    strava.rateLimiting.exceeded()

    // returns the current decimal fraction (from 0 to 1) of rate used. The greater of the short and long term limits.
    strava.rateLimiting.fractionReached();

#### Callback interface (Rate limits)

```js
const strava = require('strava-v3');
strava.athlete.get({'access_token':'abcde'},function(err,payload,limits) {
    //do something with your payload, track rate limits
    console.log(limits);
    /*
    output:
    {
       shortTermUsage: 3,
       shortTermLimit: 600,
       longTermUsage: 12,
       longTermLimit: 30000
    }
    */
});
```
### Supported API Endpoints

To used the Promise-based API, do not provide a callback. A promise will be returned.

See Strava API docs for returned data structures.

#### OAuth

* `strava.oauth.getRequestAccessURL(args)`
* `strava.oauth.getToken(code,done)` (Used to token exchange)
* `strava.oauth.refreshToken(code)` (Callback API not supported)
* `strava.oauth.deauthorize(args,done)`

#### Athlete

* `strava.athlete.get(args,done)`
* `strava.athlete.update(args,done)` // only 'weight' can be updated.
* `strava.athlete.listActivities(args,done)` *Get list of activity summaries*
* `strava.athlete.listRoutes(args,done)`
* `strava.athlete.listClubs(args,done)`
* `strava.athlete.listZones(args,done)`

#### Athletes

* `strava.athletes.get(args,done)` *Get a single activity. args.id is required*
* `strava.athletes.stats(args,done)`

#### Activities

* `strava.activities.get(args,done)`
* `strava.activities.create(args,done)`
* `strava.activities.update(args,done)`
* `strava.activities.listFriends(args,done)` -> deprecated at 2.2.0
* `strava.activities.listZones(args,done)`
* `strava.activities.listLaps(args,done)`
* `strava.activities.listComments(args,done)`
* `strava.activities.listKudos(args,done)`
* `strava.activities.listPhotos(args,done)` -> deprecated at 2.2.0

#### Clubs

* `strava.clubs.get(args,done)`
* `strava.clubs.listMembers(args,done)`
* `strava.clubs.listActivities(args,done)`
* `strava.clubs.listAdmins(args,done)`

#### Gear

* `strava.gear.get(args,done)`

#### Push Subscriptions

These methods Authenticate with a Client ID and Client Secret. Since they don't
use OAuth, they are not available on the `client` object.

 * `strava.pushSubscriptions.list({},done)`
 * `strava.pushSubscriptions.create({callback_url:...},done)`
 *  We set 'object\_type to "activity" and "aspect\_type" to "create" for you.
 * `strava.pushSubscriptions.delete({id:...},done)`

#### Running Races

 * `strava.runningRaces.get(args,done)`
 * `strava.runningRaces.listRaces(args,done)`

#### Routes

 * `strava.routes.getFile({ id: routeId, file_type: 'gpx' },done)` *file_type may also be 'tcx'*
 * `strava.routes.get(args,done)`

#### Segments

 * `strava.segments.get(args,done)`
 * `strava.segments.listStarred(args,done)`
 * `strava.segments.listEfforts(args,done)`
 * `strava.segments.explore(args,done)` *Expects arg `bounds` as a comma separated string, for two points describing a rectangular boundary for the search: `"southwest corner latitutde, southwest corner longitude, northeast corner latitude, northeast corner longitude"`*.

#### Segment Efforts

 * `strava.segmentEfforts.get(args,done)`

#### Streams

 * `strava.streams.activity(args,done)`
 * `strava.streams.effort(args,done)`
 * `strava.streams.segment(args,done)`

#### Uploads

 * `strava.uploads.post(args,done)`

## Error Handling

Except for the OAuth calls, errors returned will be instances of `StatusCodeError` when the HTTP status code is not 2xx. In the Promise-based API, the promise will be rejected. An error of type `RequestError` will be returned if the request fails for technical reasons.

The updated version now uses Axios for HTTP requests and custom error classes for compatibility with the previous implementation.

In the Promise-based API, errors will reject the Promise. In the callback-based API (where supported), errors will pass to the `err` argument in the callback.

The project no longer relies on Bluebird. Where applicable, callback handling has been removed.

Example error checking:

```javascript
    const { StatusCodeError, RequestError } = require('./axiosUtility');

    // Catch a non-2xx response with the Promise API
    badClient.athlete.get({})
        .catch(StatusCodeError, function (e) {
        });

    badClient.athlete.get({}, function(err, payload) {
      // err will be an instance of StatusCodeError or RequestError
    });
```

The `StatusCodeError` object includes extra properties to help with debugging:

 - `name` is always `StatusCodeError`
 - `statusCode` contains the HTTP status code
 - `message` contains the response's status message and additional error details
 - `data` contains the body of the response, which can be useful for debugging
 - `options` contains the options used in the request
 - `response` contains the response object

The `RequestError` object is used for errors that occur due to technical issues, such as no response being received or request setup issues, and includes the following properties:

- `name` is always `RequestError`
- `message` contains the error message
- `options` contains the options used in the request

This update maintains feature parity with the previous implementation of `request-promise` while using the Axios HTTP client under the hood.


## Development

This package includes a full test suite runnable via `yarn test`.
It will both lint and run shallow tests on API endpoints.

### Running the tests

You'll first need to supply `data/strava_config` with an `access_token` that
has both private read and write permissions. Look in `./scripts` for a tool
to help generate this token. Going forward we plan to more testing with a mocked
version of the Strava API so testing with real account credentials are not required.

* Make sure you've filled out all the fields in `data/strava_config`.
* Use `strava.oauth.getRequestAccessURL({scope:"view_private,write"})` to generate the request url and query it via your browser.
* Strava will prompt you (the user) to allow access, say yes and you'll be sent to your Authorization Redirection URI - the parameter `code` will be included in the redirection url.
* Exchange the `code` for a new `access_token`:

```js
// access_token is at payload.access_token
const payload = await strava.oauth.getToken(authorizationCode)
```
Finally, the test suite has some expectations about the Strava account that it
connects for the tests to pass. The following should be true about the Strava
data in the account:

 * Must have at least one activity posted on Strava
 * Must have joined at least one club
 * Must have added at least one piece of gear (bike or shoes)
 * Must have created at least one route
 * Most recent activity with an achievement should also contain a segment

(Contributions to make the test suite more self-contained and robust by converting more tests
to use `nock` are welcome!)

* You're done! Paste the new `access_token` to `data/strava_config` and go run some tests:

`yarn test`.

### How the tests work

Using the provided `access_token` tests will access each endpoint individually:

* (For all `GET` endpoints) checks to ensure the correct type has been returned from the Strava.
* (For `PUT` in `athlete.update`) changes some athlete properties, then changes them back.
* (For `POST/PUT/DELETE` in `activities.create/update/delete`) first creates an activity, runs some operations on it, then deletes it.

## Debugging

You can enable a debug mode for the underlying `request` module to see details
about the raw HTTP requests and responses being sent back and forth from the
Strava API.

To enable this, set this in the environment before this module is loaded:

  NODE\_DEBUG=request

You can also set `process.env.NODE_DEBUG='request' in your script before this module is loaded.

## Resources

* [Strava Developers Center](http://www.strava.com/developers)
* [Strava API Reference](https://developers.strava.com/docs/reference/)

## Author and Maintainer

Authored by Austin Brown <austin@unboundev.com> (http://austinjamesbrown.com/).

Currently Maintained by Mark Stosberg <mark@rideamigos.com>  




================================================
FILE: axiosUtility.js
================================================
const axios = require('axios')

// Custom Error Classes for compatibility with 'request-promise/errors'
class StatusCodeError extends Error {
  constructor (statusCode, statusText, data, options, response) {
    super(`Request failed with status ${statusCode}: ${statusText}`)
    this.name = 'StatusCodeError'
    this.statusCode = statusCode
    this.data = data
    this.options = options
    this.response = response
  }
}

class RequestError extends Error {
  constructor (message, options) {
    super(message)
    this.name = 'RequestError'
    this.options = options
  }
}

// Axios Wrapper Utility
const axiosInstance = axios.create({
  baseURL: 'https://www.strava.com/api/v3/',
  headers: {
    'User-Agent': `node-strava-v3 v${require('./package.json').version}`
  },
  timeout: 10000 // Set default timeout to 10 seconds
})

/**
 * Wrapper function for making HTTP requests using Axios
 * @param {Object} options - Request options similar to 'request-promise'
 * @returns {Promise} - A promise that resolves to the response of the HTTP request
 */
const httpRequest = async (options) => {
  try {
    const response = await axiosInstance({
      method: options.method || 'GET',
      url: options.uri || options.url,
      params: options.qs, // Map 'qs' to 'params' for query string parameters
      headers: {
        ...axiosInstance.defaults.headers,
        ...options.headers
      },
      data: options.body, // For request body
      responseType: options.responseType || 'json', // Support different response types
      maxRedirects: options.maxRedirects || 5, // Set max redirects
      validateStatus: options.simple === false ? () => true : undefined // Handle 'simple' option
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new StatusCodeError(
        error.response.status,
        error.response.statusText,
        error.response.data,
        options,
        error.response
      );
    } else if (error.request) {
      throw new RequestError(`No response received: ${error.message}`, options);
    } else {
      throw new RequestError(`Request setup error: ${error.message}`, options);
    }
  }
};

/**
 * Function to update default headers
 * @param {Object} headers - Headers to be updated
 */
const updateDefaultHeaders = (headers) => {
  Object.assign(axiosInstance.defaults.headers, headers)
}

/**
 * Function to set a new base URL for the Axios instance
 * @param {string} newBaseURL - New base URL
 */
const setBaseURL = (newBaseURL) => {
  axiosInstance.defaults.baseURL = newBaseURL
}

module.exports = {
  axiosInstance,
  httpRequest,
  updateDefaultHeaders,
  setBaseURL,
  StatusCodeError, // Export custom error class for compatibility
  RequestError
}



================================================
FILE: index.d.ts
================================================
type Callback = (error: any, payload: any) => void;

interface BaseArgs {
  access_token?: string;
}

interface ApplicationBaseArgs {
  client_id: string;
  client_secret: string;
}

export interface PushSubscriptionRoutes {
  list(done?: Callback): Promise<ListPushSubscriptionResponse[]>;
  create(
    args: CreatePushSubscriptionRouteArgs,
    done?: Callback
  ): Promise<CreatePushSubscriptionResponse>;
  delete(args: DeletePushSubscriptionRouteArgs, done?: Callback): Promise<void>;
}

export interface ListPushSubscriptionResponse {
  id: number;
  resource_state: number;
  application_id: number;
  callback_url: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePushSubscriptionResponse {
  id: number;
}

export interface CreatePushSubscriptionRouteArgs extends ApplicationBaseArgs {
  callback_url: string;
  verify_token: string;
}

export interface DeletePushSubscriptionRouteArgs extends ApplicationBaseArgs {
  id: string;
}

export interface UploadsRoutes {
  post(args: UploadRouteArgs, done?: Callback): Promise<UploadResponse>;
}

export interface UploadRouteArgs {
  file: Buffer;
  name: string;
  description?: string;
  trainer?: string;
  commute?: string;
  data_type: string;
  external_id: string;
}

export interface UploadResponse {
  id: string;
  id_str?: string;
  external_id?: string;
  error?: string;
  status?: string;
  activity_id?: string;
}

export interface SegmentsRoutes {
  get(args: any, done?: Callback): Promise<any>;
  listStarred(args: any, done?: Callback): Promise<any>;
  listEfforts(args: any, done?: Callback): Promise<any>;
  listLeaderboard(args: any, done?: Callback): Promise<any>;
  explore(args: any, done?: Callback): Promise<any>;
}

export interface SegmentEffortsRoutes {
  get(args: any, done?: Callback): Promise<any>;
}

export interface StreamsRoutes {
  activity(args: any, done?: Callback): Promise<any>;
  effort(args: any, done?: Callback): Promise<any>;
  segment(args: any, done?: Callback): Promise<any>;
}

export interface RoutesRoutes {
  get(args: any, done?: Callback): Promise<any>;
  getFile(args: RouteFile, done?: Callback): Promise<any>;
}

export interface DetailRoute extends BaseArgs {
  id: string;
}

export interface RouteFile extends BaseArgs {
  id: string;
  file_type: string;
}

export interface GearRoutes {
  get(args: any, done?: Callback): Promise<any>;
}

export interface RunningRacesRoutes {
  get(args: any, done?: Callback): Promise<any>;
  listRaces(args: any, done?: Callback): Promise<any>;
}

export interface ClubsRoutes {
  get(args: ClubsRoutesArgs, done?: Callback): Promise<any>;
  listMembers(args: ClubsRoutesListArgs, done?: Callback): Promise<any>;
  listActivities(
    args: ClubsRoutesListArgs,
    done?: Callback
  ): Promise<ClubActivity[]>;
  listAnnouncements(args: ClubsRoutesListArgs, done?: Callback): Promise<any>;
  listEvents(args: ClubsRoutesListArgs, done?: Callback): Promise<any>;
  listAdmins(args: ClubsRoutesListArgs, done?: Callback): Promise<any>;
  joinClub(args: ClubsRoutesListArgs, done?: Callback): Promise<any>;
  leaveClub(args: ClubsRoutesListArgs, done?: Callback): Promise<any>;
}

export interface ClubsRoutesArgs extends BaseArgs {
  id: string;
}

export interface ClubsRoutesListArgs extends ClubsRoutesArgs {
  page?: number;
  per_page?: number;
}

export interface ClubActivity {
  resource_state: number;
  athlete: {
    resource_state: number;
    firstname: string;
    lastname: string;
  };
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  type: string;
  workout_type?: number | null;
}

export interface AthletesRoutes {
  get(args: AthleteRouteArgs, done?: Callback): Promise<AthleteRouteResponse>;
  stats(args: any, done?: Callback): Promise<any>;
}

export interface AthleteRouteArgs extends BaseArgs {
  athlete_id: string;
  page?: number;
  offset?: number;
}

export interface AthleteRouteResponse {
  athlete: AthleteResponse;
  description?: string;
  distance?: number;
  elevation_gain?: number;
  id: string;
  id_str?: string;
  map?: PolylineMapResponse;
  name?: string;
  private: boolean;
  starred?: boolean;
  timestamp?: number;
  type?: number;
  sub_type?: number;
  created_at: Date;
  updated_at: Date;
  estimated_moving_time?: number;
  segments?: any[];
}

export interface AthleteResponse {
  id: string;
  resource_state?: number;
  firstname?: string;
  lastname?: string;
  profile_medium?: string;
  profile?: string;
  city?: string;
  state?: string;
  country?: string;
  sex?: string;
  premium?: boolean;
  summit?: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PolylineMapResponse {
  id: string;
  polyline: string;
  summary_polyline: string;
}

type SportType =
  | "AlpineSki"
  | "BackcountrySki"
  | "Canoeing"
  | "Crossfit"
  | "EBikeRide"
  | "Elliptical"
  | "EMountainBikeRide"
  | "Golf"
  | "GravelRide"
  | "Handcycle"
  | "Hike"
  | "IceSkate"
  | "InlineSkate"
  | "Kayaking"
  | "Kitesurf"
  | "MountainBikeRide"
  | "NordicSki"
  | "Ride"
  | "RockClimbing"
  | "RollerSki"
  | "Rowing"
  | "Run"
  | "Sail"
  | "Skateboard"
  | "Snowboard"
  | "Snowshoe"
  | "Soccer"
  | "StairStepper"
  | "StandUpPaddling"
  | "Surfing"
  | "Swim"
  | "TrailRun"
  | "Velomobile"
  | "VirtualRide"
  | "VirtualRun"
  | "Walk"
  | "WeightTraining"
  | "Wheelchair"
  | "Windsurf"
  | "Workout"
  | "Yoga";

export interface DetailedActivityResponse {
  id: string;
  athlete: {
    resource_state: number;
    firstname: string;
    lastname: string;
  };
  name: string;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
  total_elevation_gain?: number;
  elev_high?: number;
  elev_low?: number;
  sport_type: SportType;
  start_date: Date;
  start_date_local: Date;
  timezone?: string;
  utc_offset?: number;
  location_city?: string;
  location_state?: string;
  location_country?: string;
  achievement_count?: number;
  kudos_count?: number;
  comment_count?: number;
  athlete_count?: number;
  photo_count?: number;
  total_photo_count?: number;
  map?: PolylineMapResponse;
  trainer?: boolean;
  commute?: boolean;
  manual?: boolean;
  private?: boolean;
  flagged?: boolean;
  average_speed?: number;
  max_speed?: number;
  has_kudoed?: boolean;
  hide_from_home?: boolean;
  gear_id?: string;
  description?: string;
  calories?: number;
  private_notes?: string;
  start_latlng?: Array<number>;
  end_latlng?: Array<number>;
}

export interface ActivitiesRoutes {
  get(args: any, done?: Callback): Promise<DetailedActivityResponse>;
  create(args: any, done?: Callback): Promise<any>;
  update(args: any, done?: Callback): Promise<any>;
  listFriends(args: any, done?: Callback): Promise<any>;
  listZones(args: any, done?: Callback): Promise<any>;
  listLaps(args: any, done?: Callback): Promise<any>;
  listComments(args: any, done?: Callback): Promise<any>;
  listKudos(args: any, done?: Callback): Promise<any>;
  listPhotos(args: any, done?: Callback): Promise<any>;
  listRelated(args: any, done?: Callback): Promise<any>;
}

export interface AthleteRoutes {
  get(args: any, done?: Callback): Promise<any>;
  update(args: any, done?: Callback): Promise<any>;
  listActivities(args: any, done?: Callback): Promise<any>;
  listRoutes(args: any, done?: Callback): Promise<any>;
  listClubs(args: any, done?: Callback): Promise<any>;
  listZones(args: any, done?: Callback): Promise<any>;
}

export interface OAuthRoutes {
  getRequestAccessURL(args: any): Promise<any>;
  getToken(code: string, done?: Callback): Promise<any>;
  refreshToken(code: string): Promise<RefreshTokenResponse>;
  deauthorize(args: any, done?: Callback): Promise<any>;
}

export interface RefreshTokenResponse {
  token_type: string;
  access_token: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
}

export interface RateLimiting {
  exceeded(): boolean;
  fractionReached(): number;
}

export interface AuthenticationConfig {
  access_token: string;
  client_id: string;
  client_secret: string;
  redirect_uri: string;
}

export interface Strava {
  config(config: AuthenticationConfig): void;
  client(token: string): void;
  athlete: AthleteRoutes;
  athletes: AthletesRoutes;
  activities: ActivitiesRoutes;
  clubs: ClubsRoutes;
  gear: GearRoutes;
  segments: SegmentsRoutes;
  segmentEfforts: SegmentEffortsRoutes;
  pushSubscriptions: PushSubscriptionRoutes;
  streams: StreamsRoutes;
  uploads: UploadsRoutes;
  rateLimiting: RateLimiting;
  runningRaces: RunningRacesRoutes;
  routes: RoutesRoutes;
  oauth: OAuthRoutes;
}

declare const strava: Strava;
export default strava;



================================================
FILE: index.js
================================================
const HttpClient = require('./lib/httpClient')
const oauth = require('./lib/oauth')
const authenticator = require('./lib/authenticator')

const Athlete = require('./lib/athlete')
const Athletes = require('./lib/athletes')
const Activities = require('./lib/activities')
const Clubs = require('./lib/clubs')
const Gear = require('./lib/gear')
const Segments = require('./lib/segments')
const SegmentEfforts = require('./lib/segmentEfforts')
const Streams = require('./lib/streams')
const Uploads = require('./lib/uploads')
const rateLimiting = require('./lib/rateLimiting')
const RunningRaces = require('./lib/runningRaces')
const Routes = require('./lib/routes')
const PushSubscriptions = require('./lib/pushSubscriptions')
const { axiosInstance, httpRequest } = require('./axiosUtility')
const version = require('./package.json').version

const strava = {}

strava.defaultRequest = axiosInstance.create({
  baseURL: 'https://www.strava.com/api/v3/',
  headers: {
    'User-Agent': 'node-strava-v3 v' + version
  }
})

strava.client = function (token, request = httpRequest) {
  this.access_token = token

  const headers = {
    Authorization: 'Bearer ' + this.access_token
  }

  const httpClient = new HttpClient(async (options) => {
    options.headers = { ...strava.defaultRequest.defaults.headers, ...headers, ...options.headers }
    return await request(options) // Await the Promise
  })

  this.athlete = new Athlete(httpClient)
  this.athletes = new Athletes(httpClient)
  this.activities = new Activities(httpClient)
  this.clubs = new Clubs(httpClient)
  this.gear = new Gear(httpClient)
  this.segments = new Segments(httpClient)
  this.segmentEfforts = new SegmentEfforts(httpClient)
  this.streams = new Streams(httpClient)
  this.uploads = new Uploads(httpClient)
  this.rateLimiting = rateLimiting
  this.runningRaces = new RunningRaces(httpClient)
  this.routes = new Routes(httpClient)
  // No Push subscriptions on the client object because they don't use OAuth.
}

strava.config = authenticator.fetchConfig

strava.oauth = oauth

strava.defaultHttpClient = new HttpClient(async (options) => {
  options.headers = {
    ...strava.defaultRequest.defaults.headers,
    Authorization: 'Bearer ' + authenticator.getToken(),
    ...options.headers,
  }
  return await httpRequest(options) // Await the Promise
})

strava.athlete = new Athlete(strava.defaultHttpClient)
strava.athletes = new Athletes(strava.defaultHttpClient)
strava.activities = new Activities(strava.defaultHttpClient)
strava.clubs = new Clubs(strava.defaultHttpClient)
strava.gear = new Gear(strava.defaultHttpClient)
strava.segments = new Segments(strava.defaultHttpClient)
strava.segmentEfforts = new SegmentEfforts(strava.defaultHttpClient)
strava.streams = new Streams(strava.defaultHttpClient)
strava.uploads = new Uploads(strava.defaultHttpClient)
strava.rateLimiting = rateLimiting
strava.runningRaces = new RunningRaces(strava.defaultHttpClient)
strava.routes = new Routes(strava.defaultHttpClient)
strava.pushSubscriptions = new PushSubscriptions(strava.defaultHttpClient)

// and export
module.exports = strava



================================================
FILE: LICENSE
================================================
The MIT License (MIT)

Copyright (c) 2014 

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.



================================================
FILE: package.json
================================================
{
  "name": "strava-v3",
  "version": "2.2.1",
  "description": "Simple wrapper for Strava v3 API",
  "main": "index.js",
  "types": "index.d.ts",
  "scripts": {
    "test": "npx eslint *.js lib test && npx mocha test/*.js",
    "lint": "npx eslint *.js lib test"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/node-strava/node-strava-v3.git"
  },
  "keywords": [
    "strava",
    "node",
    "api"
  ],
  "author": "austin brown <austin@unboundev.com> (http://austinjamesbrown.com/)",
  "contributors": [
    "Mark Stosberg <mark@rideamigos.com>"
  ],
  "license": "MIT",
  "bugs": {
    "url": "https://github.com/node-strava/node-strava-v3/issues"
  },
  "homepage": "https://github.com/node-strava/node-strava-v3",
  "dependencies": {
    "axios": "^1.7.7",
    "json-bigint": "^1.0.0"
  },
  "devDependencies": {
    "env-restorer": "^1.0.0",
    "es6-promise": "^3.2.1",
    "eslint": "^8.3.0",
    "eslint-config-standard": "^12.0.0",
    "eslint-plugin-import": "^2.17.3",
    "eslint-plugin-node": "^9.1.0",
    "eslint-plugin-promise": "^4.1.1",
    "eslint-plugin-standard": "^4.0.0",
    "inquirer": "^7.0.0",
    "mocha": "^9.2.0",
    "mock-fs": "^4.10.1",
    "nock": "^11.3.4",
    "should": "^13.2.3",
    "sinon": "^1.17.4",
    "yargs": "^17.3.0"
  },
  "mocha": {
    "globals": [
      "should"
    ],
    "timeout": 20000,
    "checkLeaks": true,
    "ui": "bdd",
    "reporter": "spec"
  },
  "eslintConfig": {
    "extends": "standard",
    "env": {
      "mocha": true,
      "node": true
    }
  },
  "engines": {
    "node": ">=8.0.0"
  }
}



================================================
FILE: strava_config
================================================

{
    "access_token"    :"Your apps access token (Required for Quickstart)"
    , "client_id"     :"Your apps Client ID (Required for oauth)"
    , "client_secret" :"Your apps Client Secret (Required for oauth)"
    , "redirect_uri"  :"Your apps Authorization Redirection URI (Required for oauth)"
}


================================================
FILE: .drone.yml
================================================
---
kind: pipeline
type: docker

steps:
- name: build
  image: node:12
  commands:
  - npm install
- name: unit-test
  image: node:12
  commands:
  - npm test
- name: promote_test
  image: node:12
  commands:
    - echo "Testing Promote"
  when:
    event:
      - promote



================================================
FILE: .travis.yml
================================================
language: node_js
node_js:
- '8'
- '10'
- '12'
before_install: npm install -g grunt-cli



================================================
FILE: lib/activities.js
================================================
var activities = function (client) {
  this.client = client
}

var _qsAllowedProps = [

  // pagination
  'page',
  'per_page',

  // getSegment
  'include_all_efforts'
]
var _createAllowedProps = [
  'name',
  'type',
  'sport_type',
  'start_date_local',
  'elapsed_time',
  'description',
  'distance',
  'private',
  'commute'
]
var _updateAllowedProps = [
  'name',
  'type',
  'sport_type',
  'private',
  'commute',
  'trainer',
  'description',
  'gear_id'
]

//= ==== activities endpoint =====
activities.prototype.get = function (args, done) {
  var qs = this.client.getQS(_qsAllowedProps, args)

  _requireActivityId(args)

  var endpoint = 'activities/' + args.id + '?' + qs
  return this.client.getEndpoint(endpoint, args, done)
}
activities.prototype.create = function (args, done) {
  var endpoint = 'activities'

  args.body = this.client.getRequestBodyObj(_createAllowedProps, args)
  return this.client.postEndpoint(endpoint, args, done)
}
activities.prototype.update = function (args, done) {
  var form = this.client.getRequestBodyObj(_updateAllowedProps, args)

  _requireActivityId(args)

  var endpoint = 'activities/' + args.id

  args.form = form

  return this.client.putEndpoint(endpoint, args, done)
}

activities.prototype.listZones = function (args, done) {
  _requireActivityId(args)

  var endpoint = 'activities/' + args.id + '/zones'

  return this._listHelper(endpoint, args, done)
}
activities.prototype.listLaps = function (args, done) {
  _requireActivityId(args)

  var endpoint = 'activities/' + args.id + '/laps'

  return this._listHelper(endpoint, args, done)
}
activities.prototype.listComments = function (args, done) {
  _requireActivityId(args)

  var endpoint = 'activities/' + args.id + '/comments'

  return this._listHelper(endpoint, args, done)
}
activities.prototype.listKudos = function (args, done) {
  _requireActivityId(args)

  var endpoint = 'activities/' + args.id + '/kudos'

  return this._listHelper(endpoint, args, done)
}
//= ==== activities endpoint =====

//= ==== helpers =====
var _requireActivityId = function (args) {
  if (typeof args.id === 'undefined') {
    throw new Error('args must include an activity id')
  }
}

activities.prototype._listHelper = function (endpoint, args, done) {
  var qs = this.client.getPaginationQS(args)

  endpoint += '?' + qs
  return this.client.getEndpoint(endpoint, args, done)
}
//= ==== helpers =====

module.exports = activities



================================================
FILE: lib/athlete.js
================================================
var athlete = function (client) {
  this.client = client
}

var _qsAllowedProps = [

  // pagination
  'page',
  'per_page',

  // listActivities
  'before',
  'after'
]
var _updateAllowedProps = [
  'weight',
  'ftp'
]

//= ==== athlete endpoint =====
athlete.prototype.get = function (args, done) {
  var endpoint = 'athlete'
  return this.client.getEndpoint(endpoint, args, done)
}
athlete.prototype.listActivities = function (args, done) {
  return this._listHelper('activities', args, done)
}
athlete.prototype.listClubs = function (args, done) {
  return this._listHelper('clubs', args, done)
}
athlete.prototype.listRoutes = function (args, done) {
  return this._listHelper('routes', args, done)
}
athlete.prototype.listZones = function (args, done) {
  return this._listHelper('zones', args, done)
}

athlete.prototype.update = function (args, done) {
  var endpoint = 'athlete'
  var form = this.client.getRequestBodyObj(_updateAllowedProps, args)

  args.form = form
  return this.client.putEndpoint(endpoint, args, done)
}
//= ==== athlete.prototype endpoint =====

//= ==== helpers =====
athlete.prototype._listHelper = function (listType, args, done) {
  var endpoint = 'athlete/'
  var qs = this.client.getQS(_qsAllowedProps, args)

  endpoint += listType + '?' + qs
  return this.client.getEndpoint(endpoint, args, done)
}
//= ==== helpers =====

module.exports = athlete



================================================
FILE: lib/athletes.js
================================================
var athletes = function (client) {
  this.client = client
}

//= ==== athletes endpoint =====
athletes.prototype.get = function (args, done) {
  return this._listHelper('', args, done)
}
athletes.prototype.stats = function (args, done) {
  return this._listHelper('stats', args, done)
}
//= ==== athletes endpoint =====

//= ==== helpers =====
athletes.prototype._listHelper = function (listType, args, done) {
  var endpoint = 'athletes/'
  var qs = this.client.getPaginationQS(args)

  // require athlete id
  if (typeof args.id === 'undefined') {
    throw new Error('args must include an athlete id')
  }

  endpoint += args.id + '/' + listType + '?' + qs
  return this.client.getEndpoint(endpoint, args, done)
}
//= ==== helpers =====

module.exports = athletes



================================================
FILE: lib/authenticator.js
================================================
var fs = require('fs')

var configPath = 'data/strava_config'

var token
var clientId
var clientSecret
var redirectUri

var readConfigFile = function () {
  try {
    var config = fs.readFileSync(configPath, { encoding: 'utf-8' })
    config = JSON.parse(config)
    if (config.access_token) token = config.access_token
    if (config.client_id) clientId = config.client_id
    if (config.client_secret) clientSecret = config.client_secret
    if (config.redirect_uri) redirectUri = config.redirect_uri
  } catch (err) {
    // Config file does not exist. This may be a valid case if the config is
    // either passed directly as an argument or via environment variables
  }
}

var readEnvironmentVars = function () {
  if (typeof process.env.STRAVA_ACCESS_TOKEN !== 'undefined') { token = process.env.STRAVA_ACCESS_TOKEN }
  if (typeof process.env.STRAVA_CLIENT_ID !== 'undefined') { clientId = process.env.STRAVA_CLIENT_ID }
  if (typeof process.env.STRAVA_CLIENT_SECRET !== 'undefined') { clientSecret = process.env.STRAVA_CLIENT_SECRET }
  if (typeof process.env.STRAVA_REDIRECT_URI !== 'undefined') { redirectUri = process.env.STRAVA_REDIRECT_URI }
}

var fetchConfig = function (config) {
  if (config) {
    if (config.access_token) token = config.access_token
    if (config.client_id) clientId = config.client_id
    if (config.client_secret) clientSecret = config.client_secret
    if (config.redirect_uri) redirectUri = config.redirect_uri
  } else {
    readConfigFile()
    readEnvironmentVars()
  }
}

module.exports = {
  fetchConfig: fetchConfig,
  getToken: function () {
    if (!token) {
      fetchConfig()
    }

    if (token) {
      return token
    } else {
      return undefined
    }
  },
  getClientId: function () {
    if (!clientId) {
      fetchConfig()
    }

    if (clientId) {
      return clientId
    } else {
      console.log('No client id found')
      return undefined
    }
  },
  getClientSecret: function () {
    if (!clientSecret) {
      fetchConfig()
    }

    if (clientSecret) {
      return clientSecret
    } else {
      console.log('No client secret found')
      return undefined
    }
  },
  getRedirectUri: function () {
    if (!redirectUri) {
      fetchConfig()
    }

    if (redirectUri) {
      return redirectUri
    } else {
      console.log('No redirectUri found')
      return undefined
    }
  },
  purge: function () {
    token = undefined
    clientId = undefined
    clientSecret = undefined
    redirectUri = undefined
  }
}



================================================
FILE: lib/clubs.js
================================================
var clubs = function (client) {
  this.client = client
}

//= ==== clubs endpoint =====
clubs.prototype.get = function (args, done) {
  var endpoint = 'clubs/'

  // require club id
  if (typeof args.id === 'undefined') {
    const err = { msg: 'args must include a club id' }
    return done(err)
  }

  endpoint += args.id
  return this.client.getEndpoint(endpoint, args, done)
}
clubs.prototype.listMembers = function (args, done) {
  return this._listHelper('members', args, done)
}
clubs.prototype.listActivities = function (args, done) {
  return this._listHelper('activities', args, done)
}
clubs.prototype.listAdmins = function (args, done) {
  return this._listHelper('admins', args, done)
}
//= ==== clubs endpoint =====

//= ==== helpers =====
clubs.prototype._listHelper = function (listType, args, done) {
  var endpoint = 'clubs/'
  var err = null
  var qs = this.client.getPaginationQS(args)

  // require club id
  if (typeof args.id === 'undefined') {
    err = { 'msg': 'args must include a club id' }
    return done(err)
  }

  endpoint += args.id + '/' + listType + '?' + qs

  return this.client.getEndpoint(endpoint, args, done)
}
//= ==== helpers =====

module.exports = clubs



================================================
FILE: lib/gear.js
================================================
var gear = function (client) {
  this.client = client
}

gear.prototype.get = function (args, done) {
  var endpoint = 'gear/'

  // require gear id
  if (typeof args.id === 'undefined') {
    throw new Error('args must include a gear id')
  }

  endpoint += args.id
  return this.client.getEndpoint(endpoint, args, done)
}

module.exports = gear



================================================
FILE: lib/httpClient.js
================================================
/* eslint camelcase: 0 */
const JSONbig = require('json-bigint')
const querystring = require('querystring')
const fs = require('fs')
const rateLimiting = require('./rateLimiting')

// request.debug = true

var HttpClient = function (request) {
  this.request = request
}

//= ==== generic GET =====
HttpClient.prototype.getEndpoint = async function (endpoint, args) {
  if (!args) {
    args = {}
  }

  var options = { url: endpoint }

  if (args.access_token) {
    options.headers = { Authorization: 'Bearer ' + args.access_token }
  }

  return this._requestHelper(options)
}

//= ==== generic PUT =====
HttpClient.prototype.putEndpoint = async function (endpoint, args) {
  if (!args) {
    args = {}
  }

  // stringify the body object for passage
  let qs = querystring.stringify(args.body)

  const options = {
    url: endpoint,
    method: 'PUT',
    body: qs
  }

  if (args.access_token) {
    options.headers = { Authorization: 'Bearer ' + args.access_token }
  }

  // add form data if present
  if (args.form) { options.form = args.form }

  return this._requestHelper(options)
}

//= ==== generic POST =====
HttpClient.prototype.postEndpoint = async function (endpoint, args) {
  if (!args) {
    args = {}
  }

  var options = {
    url: endpoint,
    method: 'POST',
    body: args.body
  }

  if (args.access_token) {
    options.headers = { Authorization: 'Bearer ' + args.access_token }
  }

  // add form data if present
  if (args.form) { options.form = args.form }

  // add multipart data if present
  if (args.multipart) { options.multipart = args.multipart }

  return this._requestHelper(options)
}

//= ==== generic DELETE =====
HttpClient.prototype.deleteEndpoint = async function (endpoint, args) {
  if (!args) {
    args = {}
  }

  // stringify the body object for passage
  const qs = querystring.stringify(args.body)

  var options = {
    url: endpoint,
    method: 'DELETE',
    body: qs
  }

  if (args.access_token) {
    options.headers = { Authorization: 'Bearer ' + args.access_token }
  }

  return this._requestHelper(options)
}

//= ==== postUpload =====
HttpClient.prototype.postUpload = async function (args = {}) {
  var options = {
    url: 'uploads',
    method: 'POST',
    formData: {
      ...args.formData,
      file: fs.createReadStream(args.file)
    }
  }

  if (args.access_token) {
    options.headers = { Authorization: 'Bearer ' + args.access_token }
  }

  return this.request.post(options)
}

//= ==== get pagination query string =====
HttpClient.prototype.getPaginationQS = function (args) {
  // setup pagination query args
  var page = typeof args.page !== 'undefined' ? args.page : null
  // eslint-disable-next-line camelcase
  var per_page = typeof args.per_page !== 'undefined' ? args.per_page : null
  var qa = {}
  var qs

  if (page) { qa.page = page }
  // eslint-disable-next-line camelcase
  if (per_page !== null) { qa.per_page = per_page }

  qs = querystring.stringify(qa)

  return qs
}
//= ==== generic get query string =====
HttpClient.prototype.getQS = function (allowedProps, args) {
  var qa = {}
  var qs

  for (var i = 0; i < allowedProps.length; i++) {
    if (args.hasOwnProperty(allowedProps[i])) { qa[allowedProps[i]] = args[allowedProps[i]] }
  }

  qs = querystring.stringify(qa)
  return qs
}

//= ==== get request body object =====
HttpClient.prototype.getRequestBodyObj = function (allowedProps, args) {
  var body = {}

  for (var i = 0; i < allowedProps.length; i++) {
    if (args.hasOwnProperty(allowedProps[i])) { body[allowedProps[i]] = args[allowedProps[i]] }
  }

  return body
}

//= ==== helpers =====
HttpClient.prototype._requestHelper = async function (options) {
  // We need the full response so we can get at the headers
  options.resolveWithFullResponse = true

  // reject promise with 'StatusCodeError' for non-2xx responses.
  // This would include 3xx redirects and 304 Request-Not-Modified,
  // Neither of which the Strava API is expected to return.
  options.simple = true

  try {
    const response = await this.request(options)
  
    // Update rate limits using headers from the successful response
    rateLimiting.updateRateLimits(response.headers)
  
    // Return the parsed response body
    return JSONbig.parse(response.body)
  } catch (e) {
    // If the error includes a response, update the rate limits using its headers
    if (e.response && e.response.headers) {
      rateLimiting.updateRateLimits(e.response.headers)
    }
  
    // Re-throw the error to ensure it's handled elsewhere
    throw e
  }
}

//= ==== helpers =====

module.exports = HttpClient



================================================
FILE: lib/oauth.js
================================================
const authenticator = require('./authenticator')
const { httpRequest } = require('../axiosUtility')
const querystring = require('querystring')

const oauth = {}

oauth.getRequestAccessURL = function (args) {
  if (!authenticator.getRedirectUri() || !authenticator.getClientId()) {
    throw new Error('The redirect_uri or the client_id was not provided, you must provide both of them!')
  }

  var url = 'https://www.strava.com/oauth/authorize?'
  var oauthArgs = {
    client_id: authenticator.getClientId(),
    redirect_uri: authenticator.getRedirectUri(),
    response_type: 'code'
  }

  if (args.scope) { oauthArgs.scope = args.scope }
  if (args.state) { oauthArgs.state = args.state }
  if (args.approval_prompt) { oauthArgs.approval_prompt = args.approval_prompt }

  var qs = querystring.stringify(oauthArgs)

  url += qs
  return url
}

/*
 *  oauth.getToken(authorization_code)
 *
 *  Implement OAuth Token Exchange.
 *
 *  Example Response:
 *
 *  {
 *     "token_type": "Bearer",
 *     "access_token": "987654321234567898765432123456789",
 *     "athlete": {
 *       #{summary athlete representation}
 *     },
 *     "refresh_token": "1234567898765432112345678987654321",
 *     "expires_at": 1531378346,
 *     "state": "STRAVA"
 *   }
 *
 *  Ref: http://developers.strava.com/docs/authentication/
 */
oauth.getToken = async function (authorizationCode) {
  const options = {
    method: 'POST',
    url: 'https://www.strava.com/oauth/token',
    json: true,
    qs: {
      code: authorizationCode,
      client_secret: authenticator.getClientSecret(),
      client_id: authenticator.getClientId(),
      grant_type: 'authorization_code'
    }
  }

  return await httpRequest(options)
}

/**
 * Deauthorizes a user
 * @param {Object} args - Includes the access token to be deauthorized
 * @returns {Promise} - Resolves with the deauthorization response
 */
oauth.deauthorize = async function (args) {
  const options = {
    url: 'https://www.strava.com/oauth/deauthorize',
    method: 'POST',
    json: true,
    // We want to consider some 30x responses valid as well
    // 'simple' would only consider 2xx responses successful
    simple: false,
    headers: {
      Authorization: 'Bearer ' + args.access_token
    }
  }

  return await httpRequest(options)
}

/**
 *
 *    oauth.refreshToken(refreshToken)
 *
 * Returns a promise. (Callback API is not supported)
 *
 * client ID and secret must be pre-configured.
 *
 * Exchange a refresh token for a new access token
 * Structure returned from Strava looks like:
 *
 * {
 *    "access_token": "38c8348fc7f988c39d6f19cf8ffb17ab05322152",
 *    "expires_at": 1568757689,
 *    "expires_in": 21432,
 *    "refresh_token": "583809f59f585bdb5363a4eb2a0ac19562d73f05",
 *    "token_type": "Bearer"
 *  }
 *  Ref: http://developers.strava.com/docs/authentication/#refresh-expired-access-tokens
 */
oauth.refreshToken = async function (refreshToken) {
  const options = {
    url: 'https://www.strava.com/oauth/token',
    method: 'POST',
    json: true,
    simple: true,
    qs: {
      refresh_token: refreshToken,
      client_id: authenticator.getClientId(),
      client_secret: authenticator.getClientSecret(),
      grant_type: 'refresh_token'
    }
  }

  return await httpRequest(options)
}

module.exports = oauth



================================================
FILE: lib/pushSubscriptions.js
================================================
var authenticator = require('./authenticator')

// Ref: https://developers.strava.com/docs/webhooks/

var pushSubscriptions = function (client) {
  this.client = client
}

var _allowedPostProps = [
  'object_type',
  'aspect_type',
  'callback_url',
  'verify_token'
]

pushSubscriptions.prototype.create = function (args, done) {
  if (typeof args.callback_url === 'undefined') {
    return done({ 'msg': 'required args missing' })
  }

  // The Strava API currently only has one valid value for these,
  // so set them as the default.
  if (args.object_type === undefined) {
    args.object_type = 'activity'
  }

  if (args.aspect_type === undefined) {
    args.aspect_type = 'create'
  }

  args.body = this.client.getRequestBodyObj(_allowedPostProps, args)

  args.body.client_secret = authenticator.getClientSecret()
  args.body.client_id = authenticator.getClientId()

  return this.client._requestHelper({
    headers: { Authorization: null },
    baseUrl: this.baseUrl,
    url: 'push_subscriptions',
    method: 'POST',
    form: args.body
  }, done)
}

pushSubscriptions.prototype.list = function (done) {
  var qs = this.client.getQS(['client_secret', 'client_id'], {
    client_secret: authenticator.getClientSecret(),
    client_id: authenticator.getClientId()
  })
  return this.client._requestHelper({
    headers: { Authorization: null },
    baseUrl: this.baseUrl,
    url: 'push_subscriptions?' + qs
  }, done)
}

pushSubscriptions.prototype.delete = function (args, done) {
  // require subscription id
  if (typeof args.id === 'undefined') {
    return done({ msg: 'args must include a push subscription id' })
  }

  var qs = this.client.getQS(['client_secret', 'client_id'], {
    client_secret: authenticator.getClientSecret(),
    client_id: authenticator.getClientId()
  })

  return this.client._requestHelper({
    headers: { Authorization: null },
    baseUrl: this.baseUrl,
    url: 'push_subscriptions/' + args.id + '?' + qs,
    method: 'DELETE'
  }, done)
}

module.exports = pushSubscriptions



================================================
FILE: lib/rateLimiting.js
================================================

var RateLimit = {
  requestTime: new Date(), // Date
  shortTermLimit: 0, // Int
  longTermLimit: 0, // Int
  shortTermUsage: 0, // Int
  longTermUsage: 0 // Init
}

var rl = RateLimit

// should be called as `strava.rateLimiting.exceeded()
// to determine if the most recent request exceeded the rate limit
RateLimit.exceeded = function () {
  if (rl.shortTermUsage >= rl.shortTermLimit) {
    return true
  }

  if (rl.longTermUsage >= rl.longTermLimit) {
    return true
  }

  return false
}

// fractionReached returns the current fraction of rate used.
// The greater of the short and long term limits.
// Should be called as `strava.rateLimiting.fractionReached()`
RateLimit.fractionReached = function () {
  var shortLimitFraction = rl.shortTermUsage / rl.shortTermLimit
  var longLimitFraction = rl.longTermUsage / rl.longTermLimit

  if (shortLimitFraction > longLimitFraction) {
    return shortLimitFraction
  } else {
    return longLimitFraction
  }
}

RateLimit.parseRateLimits = function (headers) {
  if (!headers || !headers['x-ratelimit-limit'] || !headers['x-ratelimit-usage']) {
    return null
  }

  var limit = headers['x-ratelimit-limit'].split(',')
  var usage = headers['x-ratelimit-usage'].split(',')
  var radix = 10

  return {
    shortTermUsage: parseInt(usage[0], radix),
    shortTermLimit: parseInt(limit[0], radix),
    longTermUsage: parseInt(usage[1], radix),
    longTermLimit: parseInt(limit[1], radix)
  }
}

RateLimit.updateRateLimits = function (headers) {
  var newLimits = this.parseRateLimits(headers)
  if (newLimits) {
    this.requestDate = new Date()
    this.shortTermLimit =
      !isNaN(newLimits.shortTermLimit) ? newLimits.shortTermLimit : 0
    this.shortTermUsage =
      !isNaN(newLimits.shortTermUsage) ? newLimits.shortTermUsage : 0
    this.longTermLimit =
      !isNaN(newLimits.longTermLimit) ? newLimits.longTermLimit : 0
    this.longTermUsage =
      !isNaN(newLimits.longTermUsage) ? newLimits.longTermUsage : 0
  } else {
    this.clear()
  }
  return newLimits
}

RateLimit.clear = function () {
  this.requestTime = new Date()
  this.shortTermLimit = 0
  this.longTermLimit = 0
  this.shortTermUsage = 0
  this.longTermUsage = 0
}

module.exports = RateLimit



================================================
FILE: lib/routes.js
================================================
var routes = function (client) {
  this.client = client
}

var _qsAllowedProps = []

//= ==== routes endpoint =====
routes.prototype.get = function (args, done) {
  var endpoint = 'routes/'
  var qs = this.client.getQS(_qsAllowedProps, args)

  _requireRouteId(args)

  endpoint += args.id + '?' + qs
  return this.client.getEndpoint(endpoint, args, done)
}

routes.prototype.getFile = function (args, done) {
  var endpoint = 'routes/'

  _requireRouteId(args)

  this._getFileHelper(endpoint, args, done)
}
//= ==== routes endpoint =====

//= ==== helpers =====
var _requireRouteId = function (args) {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('args must include a valid route id')
  }
}

routes.prototype._getFileHelper = function (endpoint, args, done) {
  var qs = this.client.getQS(_qsAllowedProps, args)

  endpoint += args.id + `/export_${args.file_type}` + '?' + qs
  return this.client.getEndpoint(endpoint, args, done)
}
//= ==== helpers =====

module.exports = routes



================================================
FILE: lib/runningRaces.js
================================================
var runningRaces = function (client) {
  this.client = client
}

var _qsAllowedProps = [
  'year'
]

runningRaces.prototype.get = function (args, done) {
  var endpoint = 'running_races/'

  // require running race id
  if (typeof args.id === 'undefined') {
    throw new Error('args must include an race id')
  }

  endpoint += args.id
  return this.client.getEndpoint(endpoint, args, done)
}

runningRaces.prototype.listRaces = function (args, done) {
  var qs = this.client.getQS(_qsAllowedProps, args)
  var endpoint = 'running_races?' + qs

  return this.client.getEndpoint(endpoint, args, done)
}

module.exports = runningRaces



================================================
FILE: lib/segmentEfforts.js
================================================
var segmentEfforts = function (client) {
  this.client = client
}

//= ==== segment_efforts endpoint =====
segmentEfforts.prototype.get = function (args, done) {
  var endpoint = 'segment_efforts/'

  // require segment id
  if (typeof args.id === 'undefined') {
    throw new Error('args must include a segment id')
  }

  endpoint += args.id
  return this.client.getEndpoint(endpoint, args, done)
}
//= ==== segment_efforts endpoint =====

module.exports = segmentEfforts



================================================
FILE: lib/segments.js
================================================
var segments = function (client) {
  this.client = client
}

// Validation could be tightened up here by only allowing the properties to validate
// for the single endpoint they are valid for.
var _qsAllowedProps = [

  // pagination
  'page',
  'per_page',

  // listSegments
  'athlete_id',
  'gender',
  'age_group',
  'weight_class',
  'following',
  'club_id',
  'date_range',
  'start_date_local',
  'end_date_local',

  // explore
  'bounds',
  'activity_type',
  'min_cat',
  'max_cat',
  // leaderboard
  'context_entries'
]
var _updateAllowedProps = [
  // star segment
  'starred'
]

//= ==== segments endpoint =====
segments.prototype.get = function (args, done) {
  var endpoint = 'segments/'
  this.client.getPaginationQS(args)

  // require segment id
  if (typeof args.id === 'undefined') {
    const err = { msg: 'args must include an segment id' }
    return done(err)
  }

  endpoint += args.id
  return this.client.getEndpoint(endpoint, args, done)
}

segments.prototype.listStarred = function (args, done) {
  var qs = this.client.getQS(_qsAllowedProps, args)
  var endpoint = 'segments/starred?' + qs

  return this.client.getEndpoint(endpoint, args, done)
}

segments.prototype.starSegment = function (args, done) {
  var endpoint = 'segments/'
  var form = this.client.getRequestBodyObj(_updateAllowedProps, args)
  var err = null

  if (typeof args.id === 'undefined') {
    err = { msg: 'args must include an segment id' }
    return done(err)
  }

  endpoint += args.id + '/starred'
  args.form = form

  return this.client.putEndpoint(endpoint, args, done)
}

segments.prototype.listEfforts = function (args, done) {
  return this._listHelper('all_efforts', args, done)
}

segments.prototype.explore = function (args, done) {
  var qs = this.client.getQS(_qsAllowedProps, args)
  var endpoint = 'segments/explore?' + qs

  return this.client.getEndpoint(endpoint, args, done)
}
//= ==== segments endpoint =====

//= ==== helpers =====
segments.prototype._listHelper = function (listType, args, done) {
  var endpoint = 'segments/'
  var err = null
  var qs = this.client.getQS(_qsAllowedProps, args)

  // require segment id
  if (typeof args.id === 'undefined') {
    err = { msg: 'args must include a segment id' }
    return done(err)
  }

  endpoint += args.id + '/' + listType + '?' + qs
  return this.client.getEndpoint(endpoint, args, done)
}
//= ==== helpers =====

module.exports = segments



================================================
FILE: lib/streams.js
================================================
var streams = function (client) {
  this.client = client
}

var _qsAllowedProps = [
  'resolution',
  'series_type'
]

//= ==== streams endpoint =====
streams.prototype.activity = function (args, done) {
  var endpoint = 'activities'
  return this._typeHelper(endpoint, args, done)
}

streams.prototype.effort = function (args, done) {
  var endpoint = 'segment_efforts'
  return this._typeHelper(endpoint, args, done)
}

streams.prototype.segment = function (args, done) {
  var endpoint = 'segments'
  return this._typeHelper(endpoint, args, done)
}

streams.prototype.route = function (args, done) {
  var endpoint = 'routes'
  return this._typeHelper(endpoint, args, done)
}
//= ==== streams endpoint =====

//= ==== helpers =====
streams.prototype._typeHelper = function (endpoint, args, done) {
  var qs = this.client.getQS(_qsAllowedProps, args)

  // require id
  if (typeof args.id === 'undefined') {
    throw new Error('args must include an id')
  }
  // require types
  if (typeof args.types === 'undefined') {
    throw new Error('args must include types')
  }

  endpoint += '/' + args.id + '/streams/' + args.types + '?' + qs
  return this.client.getEndpoint(endpoint, args, done)
}
//= ==== helpers =====

module.exports = streams



================================================
FILE: lib/uploads.js
================================================
var uploads = function (client) {
  this.client = client
}

var _allowedFormProps = [
  'activity_type',
  'name',
  'description',
  'private',
  'trainer',
  'data_type'
]

uploads.prototype.post = function (args, done) {
  var self = this

  // various requirements
  if (
    typeof args.file === 'undefined' || typeof args.data_type === 'undefined'
  ) {
    throw new Error('args must include both file and data_type')
  }

  // setup formData for request
  args.formData = {}
  for (var i = 0; i < _allowedFormProps.length; i++) {
    if (args[_allowedFormProps[i]]) { args.formData[_allowedFormProps[i]] = args[_allowedFormProps[i]] }
  }

  return this.client.postUpload(args, function (err, payload) {
    // finish off this branch of the call and let the
    // status checking bit happen after
    done(err, payload)

    if (!err && args.statusCallback) {
      var checkArgs = {
        id: payload.id,
        access_token: args.access_token
      }
      return self._check(checkArgs, args.statusCallback)
    }
  })
}

uploads.prototype._check = function (args, cb) {
  var endpoint = 'uploads'
  var self = this

  endpoint += '/' + args.id
  return this.client.getEndpoint(endpoint, args, function (err, payload) {
    if (!err) {
      cb(err, payload)
      if (!self._uploadIsDone(payload)) {
        setTimeout(function () {
          self._check(args, cb)
        }, 1000)
      }
    } else {
      cb(err)
    }
  })
}

uploads.prototype._uploadIsDone = function (args) {
  var isDone = false

  switch (args.status) {
    case 'Your activity is still being processed.':
      isDone = false
      break

    default:
      isDone = true
  }

  return isDone
}

module.exports = uploads



================================================
FILE: scripts/generate-access-token.js
================================================
#!/usr/bin/env node
const inquirer = require('inquirer')
const fs = require('fs')
const argv = require('yargs').argv
const stravaConfig = './data/strava_config'
const stravaConfigTemplate = './strava_config'
const stravaApiUrl = 'https://www.strava.com/settings/api#_=_'

const strava = require('../index.js')

/**
 * Generates the token to access the strava application
 */
console.log('Before processing, you shall fill your strava config with client id and secret provided by Strava:\n' + stravaApiUrl)

inquirer
  .prompt(
    [
      {
        type: 'input',
        name: 'clientId',
        message: 'What is your strava client id?',
        default: argv['client-id']
      },
      {
        type: 'input',
        name: 'clientSecret',
        message: 'What is your strava client secret?',
        default: argv['client-secret']
      }
    ])
  .then(function (answers) {
    // We copy the strava config file
    try {
      fs.mkdirSync('data')
    } catch (e) {
      // nothing
    }

    var content = fs.readFileSync(stravaConfigTemplate)
    fs.writeFileSync(stravaConfig, content)

    // We open the default config file and inject the client_id and client secret
    // Without these informations in the config file the getRequestAccessURL would fail
    content = fs.readFileSync(stravaConfig)
    var config = JSON.parse(content)
    config.client_id = answers.clientId
    config.client_secret = answers.clientSecret
    config.access_token = 'to define'
    // You may need to make your callback URL
    // at Strava /settings/api temporarily match this
    config.redirect_uri = 'http://localhost'

    // We update the config file
    fs.writeFileSync(stravaConfig, JSON.stringify(config))

    // Generates the url to have full access
    var url = strava.oauth.getRequestAccessURL({
      scope: 'activity:write,profile:write,read_all,profile:read_all,activity:read_all'
    })
    // We have to grab the code manually in the browser and then copy/paste it into strava_config as "access_token"
    console.log('Connect to the following url and copy the code: ' + url)

    inquirer.prompt(
      [
        {
          type: 'input',
          name: 'code',
          message: 'Enter the code obtained from previous strava url (the code parameter in redirection url)'
        }
      ])
      .then(function (answers2) {
        if (!answers2.code) {
          console.log('no code provided')
          process.exit()
        }
        strava.oauth.getToken(answers2.code).then(result => {
          // We update the access token in strava conf file
          if (result.access_token === undefined) throw new Error('Problem with provided code: ' + JSON.stringify(result))
          config.access_token = result.access_token
          fs.writeFileSync(stravaConfig, JSON.stringify(config))
        })
      })
      .then(done => console.log('Done. Details written to data/strava_config.'))
  })



================================================
FILE: test/_helper.js
================================================
var fs = require('fs')
var strava = require('../')

var testsHelper = {}

testsHelper.getSampleAthlete = function (done) {
  strava.athlete.get({}, done)
}

testsHelper.getSampleActivity = function (done) {
  strava.athlete.listActivities({ include_all_efforts: true }, function (err, payload) {
    if (err) { return done(err) }

    if (!payload.length) { return done(new Error('Must have at least one activity posted to Strava to test with.')) }

    // If we find an activity with an achievement, there's a better chance
    // that it contains a segment.
    // This is necessary for getSampleSegment, which uses this function.
    function hasAchievement (activity) { return activity.achievement_count > 1 }

    var withSegment = payload.filter(hasAchievement)[0]

    if (!withSegment) { return done(new Error('Must have at least one activity posted to Strava with a segment effort to test with.')) }

    return strava.activities.get({ id: withSegment.id, include_all_efforts: true }, done)
  })
}

testsHelper.getSampleClub = function (done) {
  strava.athlete.listClubs({}, function (err, payload) {
    if (err) { return done(err) }

    if (!payload.length) { return done(new Error('Must have joined at least one club on Strava to test with.')) }

    done(err, payload[0])
  })
}

testsHelper.getSampleRoute = function (done) {
  strava.athlete.listRoutes({}, function (err, payload) {
    if (err) { return done(err) }

    if (!payload.length) { return done(new Error('Must have created at least one route on Strava to test with.')) }

    done(err, payload[0])
  })
}

testsHelper.getSampleGear = function (done) {
  this.getSampleAthlete(function (err, payload) {
    if (err) { return done(err) }

    var gear

    if (payload.bikes && payload.bikes.length) {
      gear = payload.bikes[0]
    } else if (payload.shoes) {
      gear = payload.shoes[0]
    } else {
      return done(new Error('Must post at least one bike or shoes to Strava to test with'))
    }

    done(err, gear)
  })
}

testsHelper.getSampleSegmentEffort = function (done) {
  this.getSampleActivity(function (err, payload) {
    if (err) { return done(err) }

    if (!payload.segment_efforts.length) { return done(new Error('Must have at least one segment effort posted to Strava to test with.')) }

    done(err, payload.segment_efforts[0])
  })
}

testsHelper.getSampleSegment = function (done) {
  this.getSampleSegmentEffort(function (err, payload) {
    if (err) { return done(err) }

    done(err, payload.segment)
  })
}

testsHelper.getSampleRunningRace = function (done) {
  strava.runningRaces.listRaces({ 'year': 2015 }, function (err, payload) {
    done(err, payload[0])
  })
}

testsHelper.getAccessToken = function () {
  try {
    var config = fs.readFileSync('data/strava_config', { encoding: 'utf-8' })
    return JSON.parse(config).access_token
  } catch (e) {
    return process.env.STRAVA_ACCESS_TOKEN
  }
}

module.exports = testsHelper



================================================
FILE: test/activities.js
================================================
var should = require('should')
var sinon = require('sinon')
var strava = require('../')
var testHelper = require('./_helper')
var authenticator = require('../lib/authenticator')

var testActivity = {}

describe('activities_test', function () {
  before(function (done) {
    testHelper.getSampleActivity(function (err, sampleActivity) {
      if (err) { return done(err) }

      done()
    })
  })

  describe('#create()', function () {
    it('should create an activity', function (done) {
      var args = {
        name: 'Most Epic Ride EVER!!!',
        elapsed_time: 18373,
        distance: 1557840,
        start_date_local: '2013-10-23T10:02:13Z',
        type: 'Ride'
      }

      strava.activities.create(args, function (err, payload) {
        if (!err) {
          testActivity = payload;
          (payload.resource_state).should.be.exactly(3)
        } else {
          console.log(err)
        }

        done()
      })
    })
  })

  describe('#get()', function () {
    it('should return information about the corresponding activity', function (done) {
      strava.activities.get({ id: testActivity.id }, function (err, payload) {
        if (!err) {
          (payload.resource_state).should.be.exactly(3)
        } else {
          console.log(err)
        }

        done()
      })
    })

    it('should return information about the corresponding activity (Promise API)', function () {
      return strava.activities.get({ id: testActivity.id })
        .then(function (payload) {
          (payload.resource_state).should.be.exactly(3)
        })
    })

    it('should work with a specified access token', function (done) {
      var token = testHelper.getAccessToken()
      var tokenStub = sinon.stub(authenticator, 'getToken', function () {
        return undefined
      })

      strava.activities.get({
        id: testActivity.id,
        access_token: token
      }, function (err, payload) {
        should(err).be.null();
        (payload.resource_state).should.be.exactly(3)
        tokenStub.restore()
        done()
      })
    })
  })

  describe('#update()', function () {
    it('should update an activity', function (done) {
      var name = 'Run like the wind!!'
      var args = {
        id: testActivity.id,
        name: name
      }

      strava.activities.update(args, function (err, payload) {
        if (!err) {
          (payload.resource_state).should.be.exactly(3);
          (payload.name).should.be.exactly(name)
        } else {
          console.log(err)
        }

        done()
      })
    })
  })

  describe('#updateSportType()', function () {
    it('should update the sport type of an activity', function (done) {
      var sportType = 'MountainBikeRide'
      var args = {
        id: testActivity.id,
        sportType: sportType
      }

      strava.activities.update(args, function (err, payload) {
        if (!err) {
          (payload.resource_state).should.be.exactly(3);
          (payload.sportType).should.be.exactly(sportType)
        } else {
          console.log(err)
        }

        done()
      })
    })
  })

  // TODO can't test b/c this requires premium account
  describe('#listZones()', function () {
    xit('should list heart rate and power zones relating to activity', function (done) {
      strava.activities.listZones({ id: testActivity.id }, function (err, payload) {
        if (!err) {
          payload.should.be.instanceof(Array)
        } else {
          console.log(err)
        }

        done()
      })
    })
  })

  describe('#listLaps()', function () {
    it('should list laps relating to activity', function (done) {
      strava.activities.listLaps({ id: testActivity.id }, function (err, payload) {
        if (!err) {
          payload.should.be.instanceof(Array)
        } else {
          console.log(err)
        }

        done()
      })
    })
  })

  describe('#listComments()', function () {
    it('should list comments relating to activity', function (done) {
      strava.activities.listComments({ id: testActivity.id }, function (err, payload) {
        if (!err) {
          payload.should.be.instanceof(Array)
        } else {
          console.log(err)
        }

        done()
      })
    })
  })

  describe('#listKudos()', function () {
    it('should list kudos relating to activity', function (done) {
      strava.activities.listKudos({ id: testActivity.id }, function (err, payload) {
        if (!err) {
          payload.should.be.instanceof(Array)
        } else {
          console.log(err)
        }

        done()
      })
    })
  })

  // TODO check w/ strava dudes, this is returning undefined instead of an empty array (no photos)
  describe('#listPhotos()', function () {
    xit('should list photos relating to activity', function (done) {
      strava.activities.listPhotos({ id: testActivity.id }, function (err, payload) {
        if (!err) {
          payload.should.be.instanceof(Array)
        } else {
          console.log(err)
        }

        done()
      })
    })
  })
})



================================================
FILE: test/athlete.js
================================================
const should = require('should')
const strava = require('../')
const testHelper = require('./_helper')

describe('athlete_test', function () {
  describe('#get()', function () {
    it('should return detailed athlete information about athlete associated to access_token (level 3)', function (done) {
      strava.athlete.get({}, function (err, payload) {
        if (!err) {
          (payload.resource_state).should.be.exactly(3)
        } else {
          console.log(err)
        }

        done()
      })
    })
  })

  describe('#listActivities()', function () {
    it('should return information about activities associated to athlete with access_token', function (done) {
      var nowSeconds = Math.floor(Date.now() / 1000)
      strava.athlete.listActivities({
        after: nowSeconds + 3600,
        before: nowSeconds + 3600
      }, function (err, payload) {
        if (!err) {
          // console.log(payload);
          payload.should.be.instanceof(Array)
        } else {
          console.log(err)
        }

        done()
      })
    })
  })

  describe('#listClubs()', function () {
    it('should return information about clubs associated to athlete with access_token', function (done) {
      strava.athlete.listClubs({}, function (err, payload) {
        if (!err) {
          payload.should.be.instanceof(Array)
        } else {
          console.log(err)
        }

        done()
      })
    })
  })

  describe('#listRoutes()', function () {
    it('should return information about routes associated to athlete with access_token', function (done) {
      strava.athlete.listRoutes({}, function (err, payload) {
        if (!err) {
          payload.should.be.instanceof(Array)
        } else {
          console.log(err)
        }

        done()
      })
    })
  })

  describe('#listZones()', function () {
    it('should return information about heart-rate zones associated to athlete with access_token', function (done) {
      strava.athlete.listZones({}, function (err, payload) {
        if (!err) {
          payload.should.be.instanceof(Object)
        } else {
          console.log(err)
        }

        done()
      })
    })
  })

  describe('#update()', function () {
    // grab the athlete so we can revert changes
    var _athletePreEdit
    before(function (done) {
      testHelper.getSampleAthlete(function (err, payload) {
        should(err).be.null()
        _athletePreEdit = payload
        done()
      })
    })

    it('should update the weight of the current athlete and revert to original', function (done) {
      var weight = 149

      strava.athlete.update({ weight }, function (err, payload) {
        if (!err) {
          should(payload.weight).equal(weight)

          // great! we've proven our point, let's reset the athlete data
          strava.athlete.update({ city: _athletePreEdit.city }, function (err, payload) {
            should(err).be.null()
            should(payload.city).equal(_athletePreEdit.city)
            done()
          })
        } else {
          console.log(err)
          done()
        }
      })
    })
  })
})



================================================
FILE: test/athletes.js
================================================
const should = require('should')
var strava = require('../')
var testHelper = require('./_helper')

var _sampleAthlete

describe('athletes', function () {
  // get the athlete so we have access to an id for testing
  before(function (done) {
    testHelper.getSampleAthlete(function (err, payload) {
      should(err).be.null()
      _sampleAthlete = payload
      done()
    })
  })

  describe('#get()', function () {
    it('should return basic athlete information (level 2)', function (done) {
      strava.athletes.get({ id: _sampleAthlete.id }, function (err, payload) {
        if (!err) {
          // console.log(payload);
          (payload.resource_state).should.be.within(2, 3)
        } else {
          console.log(err)
        }

        done()
      })
    })
  })
})

describe('#stats()', function () {
  it('should return athlete stats information', function (done) {
    strava.athletes.stats({ id: _sampleAthlete.id }, function (err, payload) {
      if (!err) {
        payload.should.have.property('biggest_ride_distance')
      } else {
        console.log(err)
      }

      done()
    })
  })
})



================================================
FILE: test/authenticator.js
================================================
require('should')
var mockFS = require('mock-fs')
var envRestorer = require('env-restorer')
var authenticator = require('../lib/authenticator')

// Restore File system mocks, authentication state and environment variables
var restoreAll = function () {
  mockFS.restore()
  authenticator.purge()
  envRestorer.restore()
}

describe('authenticator_test', function () {
  describe('#getToken()', function () {
    it('should read the access token from the config file', function () {
      mockFS({
        'data/strava_config': JSON.stringify({
          'access_token': 'abcdefghi',
          'client_id': 'jklmnopqr',
          'client_secret': 'stuvwxyz',
          'redirect_uri': 'https://sample.com'
        })
      })
      delete process.env.STRAVA_ACCESS_TOKEN
      authenticator.purge();

      (authenticator.getToken()).should.be.exactly('abcdefghi')
    })

    it('should read the access token from the env vars', function () {
      mockFS({
        'data': {}
      })
      process.env.STRAVA_ACCESS_TOKEN = 'abcdefghi'
      authenticator.purge();

      (authenticator.getToken()).should.be.exactly('abcdefghi')
    })

    afterEach(restoreAll)
  })

  describe('#getClientId()', function () {
    it('should read the client id from the config file', function () {
      mockFS({
        'data/strava_config': JSON.stringify({
          'access_token': 'abcdefghi',
          'client_id': 'jklmnopqr',
          'client_secret': 'stuvwxyz',
          'redirect_uri': 'https://sample.com'
        })
      })
      delete process.env.STRAVA_CLIENT_ID
      authenticator.purge();

      (authenticator.getClientId()).should.be.exactly('jklmnopqr')
    })

    it('should read the client id from the env vars', function () {
      mockFS({
        'data': {}
      })
      process.env.STRAVA_CLIENT_ID = 'abcdefghi'
      authenticator.purge();

      (authenticator.getClientId()).should.be.exactly('abcdefghi')
    })

    afterEach(restoreAll)
  })

  describe('#getClientSecret()', function () {
    it('should read the client secret from the config file', function () {
      mockFS({
        'data/strava_config': JSON.stringify({
          'access_token': 'abcdefghi',
          'client_id': 'jklmnopqr',
          'client_secret': 'stuvwxyz',
          'redirect_uri': 'https://sample.com'
        })
      })
      delete process.env.STRAVA_CLIENT_SECRET
      authenticator.purge();

      (authenticator.getClientSecret()).should.be.exactly('stuvwxyz')
    })

    it('should read the client secret from the env vars', function () {
      mockFS({
        'data': {}
      })
      process.env.STRAVA_CLIENT_SECRET = 'abcdefghi'
      authenticator.purge();

      (authenticator.getClientSecret()).should.be.exactly('abcdefghi')
    })
    afterEach(restoreAll)
  })

  describe('#getRedirectUri()', function () {
    it('should read the redirect URI from the config file', function () {
      mockFS({
        'data/strava_config': JSON.stringify({
          'access_token': 'abcdefghi',
          'client_id': 'jklmnopqr',
          'client_secret': 'stuvwxyz',
          'redirect_uri': 'https://sample.com'
        })
      })
      delete process.env.STRAVA_REDIRECT_URI
      authenticator.purge();

      (authenticator.getRedirectUri()).should.be.exactly('https://sample.com')
    })

    it('should read the redirect URI from the env vars', function () {
      mockFS({
        'data': {}
      })
      process.env.STRAVA_REDIRECT_URI = 'https://sample.com'
      authenticator.purge();

      (authenticator.getRedirectUri()).should.be.exactly('https://sample.com')
    })

    afterEach(restoreAll)
  })
})



================================================
FILE: test/client.js
================================================
/* eslint new-cap: 0 */
require('should')
const { StatusCodeError } = require('../axiosUtility')
const strava = require('../')
const file = require('fs').readFileSync('data/strava_config', 'utf8')
const config = JSON.parse(file)
const token = config.access_token

// Test the "client" API that is based on providing an explicit per-instance access_token
// Rather than the original global-singleton configuration design.

const client = new strava.client(token)

describe('client_test', function () {
  // All data fetching methods should work on the client (except Oauth).
  // Try client.athlete.get() as a sample
  describe('#athlete.get()', function () {
    it('Should reject promise with StatusCodeError for non-2xx response', function (done) {
      const badClient = new strava.client('BOOM')
      badClient.athlete.get({})
        .catch(StatusCodeError, function (e) {
          done()
        })
    })

    it('Callback interface should return StatusCodeError for non-2xx response', function (done) {
      const badClient = new strava.client('BOOM')
      badClient.athlete.get({}, function (err, payload) {
        err.should.be.an.instanceOf(StatusCodeError)
        done()
      })
    })

    it('should return detailed athlete information about athlete associated to access_token (level 3)', function (done) {
      client.athlete.get({}, function (err, payload) {
        if (!err) {
          (payload.resource_state).should.be.exactly(3)
        } else {
          console.log(err)
        }

        done()
      })
    })
  })
})



================================================
FILE: test/clubs.js
================================================
require('should')
var strava = require('../')
var testHelper = require('./_helper')

var _sampleClub

describe('clubs_test', function () {
  before(function (done) {
    testHelper.getSampleClub(function (err, payload) {
      if (err) { return done(err) }

      _sampleClub = payload
      done()
    })
  })

  describe('#get()', function () {
    it('should return club detailed information', function (done) {
      strava.clubs.get({ id: _sampleClub.id }, function (err, payload) {
        if (!err) {
          (payload.resource_state).should.be.exactly(3)
        } else {
          console.log(err)
        }
        done()
      })
    })
  })

  describe('#listMembers()', function () {
    it('should return a summary list of athletes in club', function (done) {
      strava.clubs.listMembers({ id: _sampleClub.id }, function (err, payload) {
        if (!err) {
          payload.should.be.instanceof(Array)
        } else {
          console.log(err)
        }
        done()
      })
    })
  })

  describe('#listActivities()', function () {
    it('should return a list of club activities', function (done) {
      strava.clubs.listActivities({ id: _sampleClub.id }, function (err, payload) {
        if (!err) {
          payload.should.be.instanceof(Array)
        } else {
          console.log(err)
        }
        done()
      })
    })
  })
})



================================================
FILE: test/config.js
================================================
require('should')
const strava = require('../')
const authenticator = require('../lib/authenticator')

describe('config_test', function () {
  describe('#config()', function () {
    it('should accept and use explicit configuration passed to config()', function () {
      strava.config({
        'access_token': 'excdefghi',
        'client_id': 'exlmnopqr',
        'client_secret': 'exuvwxyz',
        'redirect_uri': 'https://sample.com/explicit'
      });

      (authenticator.getToken()).should.be.exactly('excdefghi');
      (authenticator.getClientId()).should.be.exactly('exlmnopqr');
      (authenticator.getClientSecret()).should.be.exactly('exuvwxyz');
      (authenticator.getRedirectUri()).should.be.exactly('https://sample.com/explicit')
      authenticator.purge()
    })
  })
})



================================================
FILE: test/gear.js
================================================
require('should')
var strava = require('../')
var testHelper = require('./_helper')

var _sampleGear

describe('gear_test', function () {
  before(function (done) {
    testHelper.getSampleGear(function (err, payload) {
      if (err) { return done(err) }

      _sampleGear = payload

      if (!_sampleGear || !_sampleGear.id) { return done(new Error('At least one piece of gear posted to Strava is required for testing.')) }

      done()
    })
  })

  describe('#get()', function () {
    it('should return detailed athlete information about gear (level 3)', function (done) {
      strava.gear.get({ id: _sampleGear.id }, function (err, payload) {
        if (err) { return done(err) }

        (payload.resource_state).should.be.exactly(3)
        done()
      })
    })
  })
})



================================================
FILE: test/oauth.js
================================================
const should = require('should')
const authenticator = require('../lib/authenticator')
const querystring = require('querystring')
const strava = require('../')
const nock = require('nock')

describe('oauth_test', function () {
  describe('#getRequestAccessURL()', function () {
    it('should return the full request access url', function () {
      const targetUrl = 'https://www.strava.com/oauth/authorize?' +
        querystring.stringify({
          client_id: authenticator.getClientId(),
          redirect_uri: authenticator.getRedirectUri(),
          response_type: 'code',
          scope: 'view_private,write'
        })

      const url = strava.oauth.getRequestAccessURL({
        scope: 'view_private,write'
      })

      url.should.be.exactly(targetUrl)
    })
  })

  describe('#deauthorize()', function () {
    it('Should have method deauthorize', function () {
      strava.oauth.should.have.property('deauthorize')
    })

    it('Should return 401 with invalid token', function (done) {
      strava.oauth.deauthorize({ access_token: 'BOOM' }, function (err, payload) {
        should(err).be.null()
        should(payload).have.property('message').eql('Authorization Error')
        done()
      })
    })

    it('Should return 401 with invalid token (Promise API)', function () {
      return strava.oauth.deauthorize({ access_token: 'BOOM' })
        .then(function (payload) {
          (payload).should.have.property('message').eql('Authorization Error')
        })
    })
    // Not sure how to test since we don't have a token that we want to deauthorize
  })

  describe('#getToken()', function () {
    before(() => {
      nock('https://www.strava.com')
      // .filteringPath(() => '/oauth/token')
        .post(/^\/oauth\/token/)
      // Match requests where this is true in the query  string
        .query(qs => qs.grant_type === 'authorization_code')
        .reply(200, {
          'token_type': 'Bearer',
          'access_token': '987654321234567898765432123456789',
          'athlete': {},
          'refresh_token': '1234567898765432112345678987654321',
          'expires_at': 1531378346,
          'state': 'STRAVA'
        })
    })

    it('should return an access_token', async () => {
      const payload = await strava.oauth.getToken()
      should(payload).have.property('access_token').eql('987654321234567898765432123456789')
    })
  })

  describe('#refreshToken()', () => {
    before(() => {
      nock('https://www.strava.com')
        .filteringPath(() => '/oauth/token')
        .post(/^\/oauth\/token/)
        .reply(200,
          {
            'access_token': '38c8348fc7f988c39d6f19cf8ffb17ab05322152',
            'expires_at': 1568757689,
            'expires_in': 21432,
            'refresh_token': '583809f59f585bdb5363a4eb2a0ac19562d73f05',
            'token_type': 'Bearer'
          }
        )
    })
    it('should return expected response when refreshing token', () => {
      return strava.oauth.refreshToken('MOCK DOESNT CARE IF THIS IS VALID')
        .then(result => {
          result.should.eql(
            {
              'access_token': '38c8348fc7f988c39d6f19cf8ffb17ab05322152',
              'expires_at': 1568757689,
              'expires_in': 21432,
              'refresh_token': '583809f59f585bdb5363a4eb2a0ac19562d73f05',
              'token_type': 'Bearer'
            }
          )
        })
    })
  })
})



================================================
FILE: test/pushSubscriptions.js
================================================
'use strict'
var nock = require('nock')
var assert = require('assert')
var should = require('should')
var strava = require('../')

describe('pushSubscriptions_test', function () {
  describe('#list()', function () {
    before(() => {
      nock('https://www.strava.com')
        .filteringPath(() => '/api/v3/push_subscriptions/')
        .get(/^\/api\/v3\/push_subscriptions/)
      // The first reply just echo's the request headers so we can test them.
        .reply(200, function (uri, requestBody) {
          return { headers: this.req.headers }
        })
        .get(/^\/api\/v3\/push_subscriptions/)
        .reply(200, [
          {
            'id': 1,
            'object_type': 'activity',
            'aspect_type': 'create',
            'callback_url': 'http://you.com/callback/',
            'created_at': '2015-04-29T18:11:09.400558047-07:00',
            'updated_at': '2015-04-29T18:11:09.400558047-07:00'
          }
        ])
    })

    it('should not sent Authorization header to Strava', () => {
      return strava.pushSubscriptions.list()
        .then(result => {
          should.not.exist(result.headers.authorization)
        })
    })

    it('should return list of subscriptions', () => {
      return strava.pushSubscriptions.list()
        .then(result => {
          result.should.eql([
            {
              'id': 1,
              'object_type': 'activity',
              'aspect_type': 'create',
              'callback_url': 'http://you.com/callback/',
              'created_at': '2015-04-29T18:11:09.400558047-07:00',
              'updated_at': '2015-04-29T18:11:09.400558047-07:00'
            }
          ])
        })
    })
  })

  describe('#create({callback_url:...})', function () {
    before(() => {
      nock('https://www.strava.com')
        .filteringPath(() => '/api/v3/push_subscriptions')
      // The first reply just echo's the request headers so we can test them.
        .post(/^\/api\/v3\/push_subscriptions/)
        .reply(200, function (uri, requestBody) {
          return { headers: this.req.headers }
        })
        .post(/^\/api\/v3\/push_subscriptions/)
        .reply(200, {
          'id': 1,
          'object_type': 'activity',
          'aspect_type': 'create',
          'callback_url': 'http://you.com/callback/',
          'created_at': '2015-04-29T18:11:09.400558047-07:00',
          'updated_at': '2015-04-29T18:11:09.400558047-07:00'
        })
    })

    it('should throw with no params', () => {
      assert.throws(() => strava.pushSubscriptions.create())
    })

    it('should not sent Authorization header to Strava', () => {
      return strava.pushSubscriptions.create({
        'callback_url': 'http://you.com/callback/'
      })
        .then(result => {
          should.not.exist(result.headers.authorization)
        })
    })

    it('should return details of created activity', () => {
      return strava.pushSubscriptions.create({
        'callback_url': 'http://you.com/callback/'
      })
        .then(result => {
          result.should.eql({
            'id': 1,
            'object_type': 'activity',
            'aspect_type': 'create',
            'callback_url': 'http://you.com/callback/',
            'created_at': '2015-04-29T18:11:09.400558047-07:00',
            'updated_at': '2015-04-29T18:11:09.400558047-07:00'
          }
          )
        })
    })
  })

  describe('#delete({id:...})', function () {
    before(() => {
      // The status is not normally returned in the body.
      // We return it here because the test can't easily access the HTTP status code.
      nock('https://www.strava.com')
        .filteringPath(() => '/api/v3/push_subscriptions/1/')
      // The first reply just echo's the request headers so we can test them.
        .delete(/^\/api\/v3\/push_subscriptions\/1/)
        .reply(200, function (uri, requestBody) {
          return { headers: this.req.headers }
        })
        .delete(/^\/api\/v3\/push_subscriptions\/1/)
        .reply(204, function (uri, requestBody) {
          requestBody = JSON.parse('{"status":204}')
          return requestBody
        })
    })

    it('should throw with no id', () => {
      assert.throws(() => strava.pushSubscriptions.delete())
    })

    it('should not sent Authorization header to Strava', () => {
      return strava.pushSubscriptions.delete({ id: 1 })
        .then(result => {
          should.not.exist(result.headers.authorization)
        })
    })

    it('Should return 204 after successful delete', () => {
      return strava.pushSubscriptions.delete({ id: 1 })
        .then(result => result.should.eql({ status: 204 }))
    })

    after(() => nock.restore())
  })
})



================================================
FILE: test/rateLimiting.js
================================================

var should = require('should')
var rateLimiting = require('../lib/rateLimiting')
var testHelper = require('./_helper')

describe('rateLimiting_test', function () {
  describe('#fractionReached', function () {
    it('should update requestTime', function () {
      var before = rateLimiting.requestTime
      var headers = {
        'date': 'Tue, 10 Oct 2013 20:11:05 GMT',
        'x-ratelimit-limit': '600,30000',
        'x-ratelimit-usage': '300,10000'
      }
      rateLimiting.updateRateLimits(headers)

      should(before).not.not.eql(rateLimiting.requestTime)
    })

    it('should calculate rate limit correctly', function () {
      (rateLimiting.fractionReached()).should.eql(0.5)
    })

    it('should calculate rate limit correctly', function () {
      var headers = {
        'x-ratelimit-limit': '600,30000',
        'x-ratelimit-usage': '300,27000'
      }
      rateLimiting.updateRateLimits(headers);
      (rateLimiting.fractionReached()).should.eql(0.9)
    })

    it('should set values to zero when headers are nonsense', function () {
      var headers = {
        'x-ratelimit-limit': 'xxx',
        'x-ratelimit-usage': 'zzz'
      }
      rateLimiting.updateRateLimits(headers)
      rateLimiting.longTermUsage.should.eql(0)
      rateLimiting.shortTermUsage.should.eql(0)
      rateLimiting.longTermLimit.should.eql(0)
      rateLimiting.shortTermLimit.should.eql(0)
    })
  })

  describe('#exceeded', function () {
    it('should exceed limit when short term usage exceeds short term limit', function () {
      rateLimiting.longTermLimit = 1
      rateLimiting.longTermUsage = 0

      rateLimiting.shortTermLimit = 100
      rateLimiting.shortTermUsage = 200

      should(rateLimiting.exceeded()).be.true()
    })

    it('should not exceed rate limit when short usage is less than short term limit', function () {
      rateLimiting.shortTermLimit = 200
      rateLimiting.shortTermUsage = 100

      rateLimiting.exceeded().should.be.false()
    })

    it('should exceed rate limit when long term usage exceeds limit', function () {
      rateLimiting.shortTermLimit = 1
      rateLimiting.shortTermUsage = 0
      rateLimiting.longTermLimit = 100
      rateLimiting.longTermUsage = 200

      rateLimiting.exceeded().should.be.true()
    })

    it('should not exceed rate limit when long term usage is less than long term limit', function () {
      rateLimiting.longTermLimit = 200
      rateLimiting.longTermUsage = 100

      rateLimiting.exceeded().should.be.be.false()
    })
  })

  describe('legacy callback limits', function () {
    var limits
    before(function (done) {
      testHelper.getSampleAthlete(function (err, payload, gotLimits) {
        if (err) { return done(err) }

        limits = gotLimits || null
        done()
      })
    })

    it('should parse and return limits', function () {
      limits.should.be.a.Object()
      limits.shortTermUsage.should.be.a.Number()
      limits.shortTermLimit.should.be.above(0).and.be.a.Number()
      limits.longTermUsage.should.be.a.Number()
      limits.longTermLimit.should.be.above(0).and.be.a.Number()
    })
  })
})



================================================
FILE: test/routes.js
================================================
var should = require('should')
var strava = require('../')
var testHelper = require('./_helper')

var _sampleRoute

describe('routes_test', function () {
  before(function (done) {
    testHelper.getSampleRoute(function (err, sampleRoute) {
      if (err) { return done(err) }

      _sampleRoute = sampleRoute
      done()
    })
  })

  describe('#get()', function () {
    it('should return information about the corresponding route', function (done) {
      strava.routes.get({ id: _sampleRoute.id }, function (err, payload) {
        if (!err) {
          should(payload.resource_state).be.exactly(3)
        } else {
          console.log(err)
        }

        done()
      })
    })

    it('should return the GPX file requested with the route information', function (done) {
      strava.routes.getFile({ id: _sampleRoute.id, file_type: 'gpx' }, function (err, payload) {
        if (!err) {
          should(typeof payload).be.a.String()
        } else {
          console.log(err)
        }

        done()
      })
    })

    it('should return the TCX file requested with the route information', function (done) {
      strava.routes.getFile({ id: _sampleRoute.id, file_type: 'tcx' }, function (err, payload) {
        if (!err) {
          should(typeof payload).be.a.String()
        } else {
          console.log(err)
        }

        done()
      })
    })
  })
})



================================================
FILE: test/runningRaces.js
================================================
/* eslint handle-callback-err: 0 */
var strava = require('../')
var testHelper = require('./_helper')

var _sampleRunningRace

describe('running_race_test', function () {
  before(function (done) {
    testHelper.getSampleRunningRace(function (err, sampleRunningRace) {
      _sampleRunningRace = sampleRunningRace
      done()
    })
  })

  describe('#get()', function () {
    it('should return information about the corresponding race', function (done) {
      strava.runningRaces.get({ id: _sampleRunningRace.id }, function (err, payload) {
        if (!err) {
          (payload.resource_state).should.be.exactly(3)
        } else {
          console.log(err)
        }

        done()
      })
    })
  })
})



================================================
FILE: test/segmentEfforts.js
================================================

var strava = require('../')
var testHelper = require('./_helper')

var _sampleSegmentEffort

describe.skip('segmentEfforts_test', function () {
  before(function (done) {
    // eslint-disable-next-line handle-callback-err
    testHelper.getSampleSegmentEffort(function (err, payload) {
      _sampleSegmentEffort = payload
      done()
    })
  })

  describe('#get()', function () {
    it('should return detailed information about segment effort (level 3)', function (done) {
      strava.segmentEfforts.get({ id: _sampleSegmentEffort.id }, function (err, payload) {
        if (!err) {
          (payload.resource_state).should.be.exactly(3)
        } else {
          console.log(err)
        }

        done()
      })
    })
  })
})



================================================
FILE: test/segments.js
================================================

var strava = require('../')
var testHelper = require('./_helper')

var _sampleSegment

describe('segments_test', function () {
  before(function (done) {
    testHelper.getSampleSegment(function (err, payload) {
      if (err) { return done(err) }

      _sampleSegment = payload
      done()
    })
  })

  describe('#get()', function () {
    it('should return detailed information about segment (level 3)', function (done) {
      strava.segments.get({ id: _sampleSegment.id }, function (err, payload) {
        if (err) { return done(err) }

        if (!err) {
          (payload.resource_state).should.be.exactly(3)
        } else {
          console.log(err)
        }

        done()
      })
    })
  })

  describe('#listStarred()', function () {
    it('should list segments currently starred by athlete', function (done) {
      strava.segments.listStarred({ page: 1, per_page: 2 }, function (err, payload) {
        if (!err) {
          payload.should.be.instanceof(Array)
        } else {
          console.log(err)
        }

        done()
      })
    })
  })

  describe('#starSegment()', function () {
    it('should toggle starred segment', function (done) {
      var args = { id: _sampleSegment.id, starred: !_sampleSegment.starred }
      strava.segments.starSegment(args, function (err, payload) {
        if (!err) {
          (payload.starred).should.be.exactly(!_sampleSegment.starred)
          // revert segment star status back to original
          args.starred = _sampleSegment.starred
          strava.segments.starSegment(args, function (err, payload) {
            if (!err) {
              (payload.starred).should.be.exactly(_sampleSegment.starred)
            } else {
              console.log(err)
            }
          })
        } else {
          console.log(err)
        }

        done()
      })
    })
  })

  describe('#listEfforts()', function () {
    it('should list efforts on segment by current athlete', function (done) {
      strava.segments.listEfforts({ id: _sampleSegment.id, page: 1, per_page: 2 }, function (err, payload) {
        if (!err) {
          payload.should.be.instanceof(Array)
        } else {
          console.log(err)
        }

        done()
      })
    })

    it('should only provide efforts between dates if `start_date_local` & `end_date_local` parameters provided', function (done) {
      var startDate = new Date(new Date() - 604800000) // last week
      var endDate = new Date()

      var startString = startDate.toISOString()
      var endString = endDate.toISOString()

      strava.segments.listEfforts({ id: _sampleSegment.id, page: 1, per_page: 10, start_date_local: startString, end_date_local: endString }, function (err, payload) {
        if (!err) {
          payload.forEach(function (item) {
            var resultDate = new Date(item.start_date_local)
            resultDate.should.be.greaterThan(startDate)
            resultDate.should.be.lessThan(endDate)
          })
        } else {
          console.log(err)
        }

        done()
      })
    })
  })

  describe('#explore()', function () {
    it('should return up to 10 segments w/i the given bounds', function (done) {
      strava.segments.explore({
        bounds: '37.821362,-122.505373,37.842038,-122.465977',
        activity_type: 'running'
      }, function (err, payload) {
        if (!err) {
          payload.segments.should.be.instanceof(Array)
        } else {
          console.log(err)
        }

        done()
      })
    })
  })
})



================================================
FILE: test/streams.js
================================================
/*  eslint camelcase: 0 */

var strava = require('../')
var testHelper = require('./_helper')

var _activity_id = '2725479568'
var _segmentEffort_id = '68090153244'
var _segment_id = '68090153244'
var _route_id = ''

var _sampleActivity

describe('streams_test', function () {
  before(function (done) {
    this.timeout(5000)

    testHelper.getSampleActivity(function (err, payload) {
      if (err) { return done(err) }

      _sampleActivity = payload

      _activity_id = _sampleActivity.id
      // _segmentEffort_id = _sampleActivity.segment_efforts[0].id;
      // _segment_id = _sampleActivity.segment_efforts[0].segment.id;

      testHelper.getSampleRoute(function (err, payload) {
        _route_id = payload && payload.id

        done(err)
      })
    })
  })

  describe('#activity()', function () {
    it('should return raw data associated to activity', function (done) {
      strava.streams.activity({
        id: _activity_id,
        types: 'time,distance',
        resolution: 'low'
      }, function (err, payload) {
        if (!err) {
          payload.should.be.instanceof(Array)
        } else {
          console.log(err)
        }

        done()
      })
    })
  })

  describe.skip('#effort()', function () {
    it('should return raw data associated to segment_effort', function (done) {
      strava.streams.effort({
        id: _segmentEffort_id,
        types: 'distance',
        resolution: 'low'
      }, function (err, payload) {
        if (!err) {
          payload.should.be.instanceof(Array)
        } else {
          console.log(err)
        }

        done()
      })
    })
  })

  describe.skip('#segment()', function () {
    it('should return raw data associated to segment', function (done) {
      strava.streams.segment({
        id: _segment_id,
        types: 'distance',
        resolution: 'low'
      }, function (err, payload) {
        if (!err) {
          payload.should.be.instanceof(Array)
        } else {
          console.log(err)
        }

        done()
      })
    })
  })

  describe('#route()', function () {
    this.timeout(5000)

    it('should return raw data associated to route', function (done) {
      strava.streams.route({
        id: _route_id,
        types: '',
        resolution: 'low'
      }, function (err, payload) {
        if (!err) {
          payload.should.be.instanceof(Array)
        } else {
          console.log(err)
        }

        done()
      })
    })
  })
})



================================================
FILE: test/uploads.js
================================================
require('es6-promise').polyfill()

var should = require('should')
var strava = require('../')

describe.skip('uploads_test', function () {
  describe('#post()', function () {
    it('should upload a GPX file', function (done) {
      this.timeout(30000)
      new Promise(function (resolve, reject) {
        strava.uploads.post({
          activity_type: 'run',
          data_type: 'gpx',
          name: 'test activity',
          file: 'test/assets/gpx_sample.gpx',
          statusCallback: function (err, payload) {
            should.not.exist(err)
            should.not.exist(payload.error)

            if (payload.activity_id === null) {
              (payload.status).should.be.exactly('Your activity is still being processed.')
            } else {
              (payload.status).should.be.exactly('Your activity is ready.')
              payload.activity_id.should.be.a.Number()

              resolve(payload.activity_id)
            }
          }
          // eslint-disable-next-line handle-callback-err
        }, function (err, payload) {})
      }).then(function (activityId) {
        // clean up the uploaded activity
        strava.activities.delete({ id: activityId }, function (err, payload) {
          if (err) console.log(err)
          done()
        })
      })
    })
  })
})



================================================
FILE: test/assets/gpx_sample.gpx
================================================
<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xsi:schemaLocation="http://www.topografix.com/GPX/1/1
    http://www.topografix.com/GPX/1/1/gpx.xsd
    http://www.garmin.com/xmlschemas/GpxExtensions/v3
    http://www.garmin.com/xmlschemas/GpxExtensionsv3.xsd
    http://www.garmin.com/xmlschemas/TrackPointExtension/v1
    http://www.garmin.com/xmlschemas/TrackPointExtensionv1.xsd" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1" xmlns:gpxx="http://www.garmin.com/xmlschemas/GpxExtensions/v3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <metadata>
    <time>2015-11-25T23:45:55.000Z</time>
  </metadata>
  <trk>
    <trkseg>
      <trkpt lon="-73.5408325195312500" lat="41.0659866333007812">
        <ele>21.0</ele>
        <time>2015-11-25T23:45:55.000Z</time>
      </trkpt>
      <trkpt lon="-73.5412063598632812" lat="41.0658607482910156">
        <ele>-11.0</ele>
        <time>2015-11-25T23:46:02.000Z</time>
      </trkpt>
      <trkpt lon="-73.5413436889648438" lat="41.0658340454101562">
        <ele>-11.0</ele>
        <time>2015-11-25T23:46:04.000Z</time>
      </trkpt>
      <trkpt lon="-73.5414505004882812" lat="41.0658187866210938">
        <ele>-10.0</ele>
        <time>2015-11-25T23:46:07.000Z</time>
      </trkpt>
      <trkpt lon="-73.5414505004882812" lat="41.0658187866210938">
        <ele>-10.0</ele>
        <time>2015-11-25T23:46:08.000Z</time>
      </trkpt>
      <trkpt lon="-73.5414505004882812" lat="41.0658187866210938">
        <ele>-10.0</ele>
        <time>2015-11-25T23:46:10.000Z</time>
      </trkpt>
      <trkpt lon="-73.5414505004882812" lat="41.0658187866210938">
        <ele>-10.0</ele>
        <time>2015-11-25T23:46:15.000Z</time>
      </trkpt>
      <trkpt lon="-73.5414505004882812" lat="41.0658187866210938">
        <ele>-10.0</ele>
        <time>2015-11-25T23:46:15.000Z</time>
      </trkpt>
      <trkpt lon="-73.5419540405273438" lat="41.0660858154296875">
        <ele>-19.0</ele>
        <time>2015-11-25T23:46:22.000Z</time>
      </trkpt>
      <trkpt lon="-73.5419540405273438" lat="41.0660858154296875">
        <ele>-19.0</ele>
        <time>2015-11-25T23:46:22.000Z</time>
      </trkpt>
      <trkpt lon="-73.5421066284179688" lat="41.0662727355957031">
        <ele>-22.0</ele>
        <time>2015-11-25T23:46:26.000Z</time>
      </trkpt>
      <trkpt lon="-73.5421066284179688" lat="41.0662727355957031">
        <ele>-22.0</ele>
        <time>2015-11-25T23:46:29.000Z</time>
      </trkpt>
      <trkpt lon="-73.5421066284179688" lat="41.0662727355957031">
        <ele>-22.0</ele>
        <time>2015-11-25T23:46:30.000Z</time>
      </trkpt>
      <trkpt lon="-73.5422210693359375" lat="41.0665283203125000">
        <ele>-24.0</ele>
        <time>2015-11-25T23:46:34.000Z</time>
      </trkpt>
      <trkpt lon="-73.5422210693359375" lat="41.0665283203125000">
        <ele>-24.0</ele>
        <time>2015-11-25T23:46:37.000Z</time>
      </trkpt>
      <trkpt lon="-73.5423355102539062" lat="41.0666809082031250">
        <ele>-22.0</ele>
        <time>2015-11-25T23:46:38.000Z</time>
      </trkpt>
      <trkpt lon="-73.5424575805664062" lat="41.0667991638183594">
        <ele>-23.0</ele>
        <time>2015-11-25T23:46:45.000Z</time>
      </trkpt>
      <trkpt lon="-73.5424575805664062" lat="41.0667991638183594">
        <ele>-23.0</ele>
        <time>2015-11-25T23:46:45.000Z</time>
      </trkpt>
      <trkpt lon="-73.5424575805664062" lat="41.0667991638183594">
        <ele>-23.0</ele>
        <time>2015-11-25T23:46:46.000Z</time>
      </trkpt>
      <trkpt lon="-73.5424575805664062" lat="41.0667991638183594">
        <ele>-23.0</ele>
        <time>2015-11-25T23:46:48.000Z</time>
      </trkpt>
      <trkpt lon="-73.5424575805664062" lat="41.0667991638183594">
        <ele>-23.0</ele>
        <time>2015-11-25T23:46:50.000Z</time>
      </trkpt>
      <trkpt lon="-73.5424575805664062" lat="41.0667991638183594">
        <ele>-23.0</ele>
        <time>2015-11-25T23:46:52.000Z</time>
      </trkpt>
      <trkpt lon="-73.5424575805664062" lat="41.0667991638183594">
        <ele>-23.0</ele>
        <time>2015-11-25T23:46:54.000Z</time>
      </trkpt>
      <trkpt lon="-73.5424575805664062" lat="41.0667991638183594">
        <ele>-23.0</ele>
        <time>2015-11-25T23:46:56.000Z</time>
      </trkpt>
      <trkpt lon="-73.5424575805664062" lat="41.0667991638183594">
        <ele>-23.0</ele>
        <time>2015-11-25T23:46:58.000Z</time>
      </trkpt>
      <trkpt lon="-73.5424575805664062" lat="41.0667991638183594">
        <ele>-23.0</ele>
        <time>2015-11-25T23:47:04.000Z</time>
      </trkpt>
      <trkpt lon="-73.5424575805664062" lat="41.0667991638183594">
        <ele>-23.0</ele>
        <time>2015-11-25T23:47:06.000Z</time>
      </trkpt>
      <trkpt lon="-73.5431900024414062" lat="41.0675354003906250">
        <ele>-19.0</ele>
        <time>2015-11-25T23:47:10.000Z</time>
      </trkpt>
      <trkpt lon="-73.5432891845703125" lat="41.0676269531250000">
        <ele>-21.0</ele>
        <time>2015-11-25T23:47:14.000Z</time>
      </trkpt>
      <trkpt lon="-73.5432891845703125" lat="41.0676269531250000">
        <ele>-21.0</ele>
        <time>2015-11-25T23:47:16.000Z</time>
      </trkpt>
      <trkpt lon="-73.5432891845703125" lat="41.0676269531250000">
        <ele>-21.0</ele>
        <time>2015-11-25T23:47:18.000Z</time>
      </trkpt>
      <trkpt lon="-73.5434341430664062" lat="41.0677337646484375">
        <ele>-29.0</ele>
        <time>2015-11-25T23:47:24.000Z</time>
      </trkpt>
      <trkpt lon="-73.5435333251953125" lat="41.0678062438964844">
        <ele>-27.0</ele>
        <time>2015-11-25T23:47:26.000Z</time>
      </trkpt>
      <trkpt lon="-73.5435333251953125" lat="41.0678062438964844">
        <ele>-27.0</ele>
        <time>2015-11-25T23:47:28.000Z</time>
      </trkpt>
      <trkpt lon="-73.5435333251953125" lat="41.0678062438964844">
        <ele>-27.0</ele>
        <time>2015-11-25T23:47:30.000Z</time>
      </trkpt>
      <trkpt lon="-73.5435333251953125" lat="41.0678062438964844">
        <ele>-27.0</ele>
        <time>2015-11-25T23:47:32.000Z</time>
      </trkpt>
      <trkpt lon="-73.5435333251953125" lat="41.0678062438964844">
        <ele>-27.0</ele>
        <time>2015-11-25T23:47:38.000Z</time>
      </trkpt>
      <trkpt lon="-73.5438079833984375" lat="41.0679740905761719">
        <ele>-27.0</ele>
        <time>2015-11-25T23:47:42.000Z</time>
      </trkpt>
      <trkpt lon="-73.5439605712890625" lat="41.0680770874023438">
        <ele>-29.0</ele>
        <time>2015-11-25T23:47:44.000Z</time>
      </trkpt>
      <trkpt lon="-73.5440597534179688" lat="41.0681457519531250">
        <ele>-27.0</ele>
        <time>2015-11-25T23:47:46.000Z</time>
      </trkpt>
      <trkpt lon="-73.5441284179687500" lat="41.0681991577148438">
        <ele>-25.0</ele>
        <time>2015-11-25T23:47:48.000Z</time>
      </trkpt>
      <trkpt lon="-73.5441894531250000" lat="41.0682563781738281">
        <ele>-24.0</ele>
        <time>2015-11-25T23:47:50.000Z</time>
      </trkpt>
      <trkpt lon="-73.5441894531250000" lat="41.0682563781738281">
        <ele>-24.0</ele>
        <time>2015-11-25T23:47:52.000Z</time>
      </trkpt>
      <trkpt lon="-73.5441894531250000" lat="41.0682563781738281">
        <ele>-24.0</ele>
        <time>2015-11-25T23:47:54.000Z</time>
      </trkpt>
      <trkpt lon="-73.5441894531250000" lat="41.0682563781738281">
        <ele>-24.0</ele>
        <time>2015-11-25T23:47:56.000Z</time>
      </trkpt>
      <trkpt lon="-73.5441894531250000" lat="41.0682563781738281">
        <ele>-24.0</ele>
        <time>2015-11-25T23:47:58.000Z</time>
      </trkpt>
      <trkpt lon="-73.5445251464843750" lat="41.0685577392578125">
        <ele>-19.0</ele>
        <time>2015-11-25T23:48:02.000Z</time>
      </trkpt>
      <trkpt lon="-73.5446166992187500" lat="41.0686531066894531">
        <ele>-18.0</ele>
        <time>2015-11-25T23:48:06.000Z</time>
      </trkpt>
      <trkpt lon="-73.5446166992187500" lat="41.0686531066894531">
        <ele>-18.0</ele>
        <time>2015-11-25T23:48:08.000Z</time>
      </trkpt>
      <trkpt lon="-73.5446166992187500" lat="41.0686531066894531">
        <ele>-18.0</ele>
        <time>2015-11-25T23:48:10.000Z</time>
      </trkpt>
      <trkpt lon="-73.5447387695312500" lat="41.0687980651855469">
        <ele>-17.0</ele>
        <time>2015-11-25T23:48:12.000Z</time>
      </trkpt>
      <trkpt lon="-73.5448150634765625" lat="41.0688896179199219">
        <ele>-16.0</ele>
        <time>2015-11-25T23:48:16.000Z</time>
      </trkpt>
      <trkpt lon="-73.5448150634765625" lat="41.0688896179199219">
        <ele>-16.0</ele>
        <time>2015-11-25T23:48:18.000Z</time>
      </trkpt>
      <trkpt lon="-73.5448989868164062" lat="41.0690116882324219">
        <ele>-16.0</ele>
        <time>2015-11-25T23:48:20.000Z</time>
      </trkpt>
      <trkpt lon="-73.5449905395507812" lat="41.0691299438476562">
        <ele>-16.0</ele>
        <time>2015-11-25T23:48:24.000Z</time>
      </trkpt>
      <trkpt lon="-73.5450744628906250" lat="41.0692367553710938">
        <ele>-18.0</ele>
        <time>2015-11-25T23:48:28.000Z</time>
      </trkpt>
      <trkpt lon="-73.5450744628906250" lat="41.0692367553710938">
        <ele>-18.0</ele>
        <time>2015-11-25T23:48:30.000Z</time>
      </trkpt>
      <trkpt lon="-73.5450744628906250" lat="41.0692367553710938">
        <ele>-18.0</ele>
        <time>2015-11-25T23:48:32.000Z</time>
      </trkpt>
      <trkpt lon="-73.5450744628906250" lat="41.0692367553710938">
        <ele>-18.0</ele>
        <time>2015-11-25T23:48:34.000Z</time>
      </trkpt>
      <trkpt lon="-73.5450744628906250" lat="41.0692367553710938">
        <ele>-18.0</ele>
        <time>2015-11-25T23:48:36.000Z</time>
      </trkpt>
      <trkpt lon="-73.5450744628906250" lat="41.0692367553710938">
        <ele>-18.0</ele>
        <time>2015-11-25T23:48:38.000Z</time>
      </trkpt>
      <trkpt lon="-73.5450744628906250" lat="41.0692367553710938">
        <ele>-18.0</ele>
        <time>2015-11-25T23:48:42.000Z</time>
      </trkpt>
      <trkpt lon="-73.5450744628906250" lat="41.0692367553710938">
        <ele>-18.0</ele>
        <time>2015-11-25T23:48:44.000Z</time>
      </trkpt>
      <trkpt lon="-73.5450744628906250" lat="41.0692367553710938">
        <ele>-18.0</ele>
        <time>2015-11-25T23:48:46.000Z</time>
      </trkpt>
      <trkpt lon="-73.5450744628906250" lat="41.0692367553710938">
        <ele>-18.0</ele>
        <time>2015-11-25T23:48:48.000Z</time>
      </trkpt>
      <trkpt lon="-73.5456848144531250" lat="41.0697746276855469">
        <ele>-19.0</ele>
        <time>2015-11-25T23:48:54.000Z</time>
      </trkpt>
      <trkpt lon="-73.5456848144531250" lat="41.0697746276855469">
        <ele>-19.0</ele>
        <time>2015-11-25T23:48:56.000Z</time>
      </trkpt>
      <trkpt lon="-73.5456848144531250" lat="41.0697746276855469">
        <ele>-19.0</ele>
        <time>2015-11-25T23:48:58.000Z</time>
      </trkpt>
      <trkpt lon="-73.5456848144531250" lat="41.0697746276855469">
        <ele>-19.0</ele>
        <time>2015-11-25T23:49:00.000Z</time>
      </trkpt>
      <trkpt lon="-73.5456848144531250" lat="41.0697746276855469">
        <ele>-19.0</ele>
        <time>2015-11-25T23:49:02.000Z</time>
      </trkpt>
      <trkpt lon="-73.5459365844726562" lat="41.0700149536132812">
        <ele>-17.0</ele>
        <time>2015-11-25T23:49:06.000Z</time>
      </trkpt>
      <trkpt lon="-73.5460281372070312" lat="41.0700607299804688">
        <ele>-18.0</ele>
        <time>2015-11-25T23:49:12.000Z</time>
      </trkpt>
      <trkpt lon="-73.5460815429687500" lat="41.0701065063476562">
        <ele>-17.0</ele>
        <time>2015-11-25T23:49:14.000Z</time>
      </trkpt>
      <trkpt lon="-73.5461502075195312" lat="41.0701751708984375">
        <ele>-19.0</ele>
        <time>2015-11-25T23:49:18.000Z</time>
      </trkpt>
      <trkpt lon="-73.5462112426757812" lat="41.0702285766601562">
        <ele>-21.0</ele>
        <time>2015-11-25T23:49:20.000Z</time>
      </trkpt>
      <trkpt lon="-73.5462112426757812" lat="41.0702285766601562">
        <ele>-21.0</ele>
        <time>2015-11-25T23:49:22.000Z</time>
      </trkpt>
      <trkpt lon="-73.5463104248046875" lat="41.0702819824218750">
        <ele>-21.0</ele>
        <time>2015-11-25T23:49:24.000Z</time>
      </trkpt>
      <trkpt lon="-73.5463104248046875" lat="41.0702819824218750">
        <ele>-21.0</ele>
        <time>2015-11-25T23:49:26.000Z</time>
      </trkpt>
      <trkpt lon="-73.5463104248046875" lat="41.0702819824218750">
        <ele>-21.0</ele>
        <time>2015-11-25T23:49:28.000Z</time>
      </trkpt>
      <trkpt lon="-73.5463104248046875" lat="41.0702819824218750">
        <ele>-21.0</ele>
        <time>2015-11-25T23:49:30.000Z</time>
      </trkpt>
      <trkpt lon="-73.5463104248046875" lat="41.0702819824218750">
        <ele>-21.0</ele>
        <time>2015-11-25T23:49:32.000Z</time>
      </trkpt>
      <trkpt lon="-73.5465469360351562" lat="41.0704727172851562">
        <ele>-14.0</ele>
        <time>2015-11-25T23:49:40.000Z</time>
      </trkpt>
      <trkpt lon="-73.5466995239257812" lat="41.0705833435058594">
        <ele>-14.0</ele>
        <time>2015-11-25T23:49:42.000Z</time>
      </trkpt>
      <trkpt lon="-73.5468063354492188" lat="41.0706558227539062">
        <ele>-15.0</ele>
        <time>2015-11-25T23:49:44.000Z</time>
      </trkpt>
      <trkpt lon="-73.5468978881835938" lat="41.0707092285156250">
        <ele>-13.0</ele>
        <time>2015-11-25T23:49:46.000Z</time>
      </trkpt>
      <trkpt lon="-73.5469818115234375" lat="41.0707511901855469">
        <ele>-13.0</ele>
        <time>2015-11-25T23:49:48.000Z</time>
      </trkpt>
      <trkpt lon="-73.5469818115234375" lat="41.0707511901855469">
        <ele>-13.0</ele>
        <time>2015-11-25T23:49:50.000Z</time>
      </trkpt>
      <trkpt lon="-73.5469818115234375" lat="41.0707511901855469">
        <ele>-13.0</ele>
        <time>2015-11-25T23:49:52.000Z</time>
      </trkpt>
      <trkpt lon="-73.5469818115234375" lat="41.0707511901855469">
        <ele>-13.0</ele>
        <time>2015-11-25T23:49:54.000Z</time>
      </trkpt>
      <trkpt lon="-73.5469818115234375" lat="41.0707511901855469">
        <ele>-13.0</ele>
        <time>2015-11-25T23:49:56.000Z</time>
      </trkpt>
      <trkpt lon="-73.5469818115234375" lat="41.0707511901855469">
        <ele>-13.0</ele>
        <time>2015-11-25T23:49:58.000Z</time>
      </trkpt>
      <trkpt lon="-73.5474853515625000" lat="41.0710029602050781">
        <ele>-11.0</ele>
        <time>2015-11-25T23:50:02.000Z</time>
      </trkpt>
      <trkpt lon="-73.5474853515625000" lat="41.0710029602050781">
        <ele>-11.0</ele>
        <time>2015-11-25T23:50:06.000Z</time>
      </trkpt>
      <trkpt lon="-73.5474853515625000" lat="41.0710029602050781">
        <ele>-11.0</ele>
        <time>2015-11-25T23:50:08.000Z</time>
      </trkpt>
      <trkpt lon="-73.5477294921875000" lat="41.0709686279296875">
        <ele>-14.0</ele>
        <time>2015-11-25T23:50:12.000Z</time>
      </trkpt>
      <trkpt lon="-73.5477294921875000" lat="41.0709686279296875">
        <ele>-14.0</ele>
        <time>2015-11-25T23:50:16.000Z</time>
      </trkpt>
      <trkpt lon="-73.5479049682617188" lat="41.0709991455078125">
        <ele>-11.0</ele>
        <time>2015-11-25T23:50:18.000Z</time>
      </trkpt>
      <trkpt lon="-73.5479049682617188" lat="41.0709991455078125">
        <ele>-11.0</ele>
        <time>2015-11-25T23:50:20.000Z</time>
      </trkpt>
      <trkpt lon="-73.5479049682617188" lat="41.0709991455078125">
        <ele>-11.0</ele>
        <time>2015-11-25T23:50:24.000Z</time>
      </trkpt>
      <trkpt lon="-73.5479049682617188" lat="41.0709991455078125">
        <ele>-11.0</ele>
        <time>2015-11-25T23:50:26.000Z</time>
      </trkpt>
      <trkpt lon="-73.5479049682617188" lat="41.0709991455078125">
        <ele>-11.0</ele>
        <time>2015-11-25T23:50:28.000Z</time>
      </trkpt>
      <trkpt lon="-73.5479049682617188" lat="41.0709991455078125">
        <ele>-11.0</ele>
        <time>2015-11-25T23:50:30.000Z</time>
      </trkpt>
      <trkpt lon="-73.5479049682617188" lat="41.0709991455078125">
        <ele>-11.0</ele>
        <time>2015-11-25T23:50:32.000Z</time>
      </trkpt>
      <trkpt lon="-73.5484008789062500" lat="41.0712394714355469">
        <ele>-10.0</ele>
        <time>2015-11-25T23:50:36.000Z</time>
      </trkpt>
      <trkpt lon="-73.5485610961914062" lat="41.0713081359863281">
        <ele>-6.0</ele>
        <time>2015-11-25T23:50:42.000Z</time>
      </trkpt>
      <trkpt lon="-73.5485610961914062" lat="41.0713081359863281">
        <ele>-6.0</ele>
        <time>2015-11-25T23:50:44.000Z</time>
      </trkpt>
      <trkpt lon="-73.5487060546875000" lat="41.0714149475097656">
        <ele>-7.0</ele>
        <time>2015-11-25T23:50:48.000Z</time>
      </trkpt>
      <trkpt lon="-73.5487060546875000" lat="41.0714149475097656">
        <ele>-7.0</ele>
        <time>2015-11-25T23:50:50.000Z</time>
      </trkpt>
      <trkpt lon="-73.5487060546875000" lat="41.0714149475097656">
        <ele>-7.0</ele>
        <time>2015-11-25T23:50:52.000Z</time>
      </trkpt>
      <trkpt lon="-73.5489578247070312" lat="41.0714874267578125">
        <ele>-6.0</ele>
        <time>2015-11-25T23:50:54.000Z</time>
      </trkpt>
      <trkpt lon="-73.5490875244140625" lat="41.0714454650878906">
        <ele>-3.0</ele>
        <time>2015-11-25T23:50:58.000Z</time>
      </trkpt>
      <trkpt lon="-73.5491409301757812" lat="41.0713310241699219">
        <ele>-3.0</ele>
        <time>2015-11-25T23:51:02.000Z</time>
      </trkpt>
      <trkpt lon="-73.5491714477539062" lat="41.0712165832519531">
        <ele>-4.0</ele>
        <time>2015-11-25T23:51:06.000Z</time>
      </trkpt>
      <trkpt lon="-73.5491714477539062" lat="41.0712165832519531">
        <ele>-4.0</ele>
        <time>2015-11-25T23:51:08.000Z</time>
      </trkpt>
      <trkpt lon="-73.5491714477539062" lat="41.0712165832519531">
        <ele>-4.0</ele>
        <time>2015-11-25T23:51:10.000Z</time>
      </trkpt>
      <trkpt lon="-73.5491867065429688" lat="41.0711097717285156">
        <ele>-7.0</ele>
        <time>2015-11-25T23:51:14.000Z</time>
      </trkpt>
      <trkpt lon="-73.5492095947265625" lat="41.0710296630859375">
        <ele>-7.0</ele>
        <time>2015-11-25T23:51:16.000Z</time>
      </trkpt>
      <trkpt lon="-73.5492172241210938" lat="41.0709648132324219">
        <ele>-7.0</ele>
        <time>2015-11-25T23:51:18.000Z</time>
      </trkpt>
      <trkpt lon="-73.5492248535156250" lat="41.0709190368652344">
        <ele>-6.0</ele>
        <time>2015-11-25T23:51:20.000Z</time>
      </trkpt>
      <trkpt lon="-73.5492248535156250" lat="41.0709190368652344">
        <ele>-6.0</ele>
        <time>2015-11-25T23:51:22.000Z</time>
      </trkpt>
      <trkpt lon="-73.5492248535156250" lat="41.0709190368652344">
        <ele>-6.0</ele>
        <time>2015-11-25T23:51:24.000Z</time>
      </trkpt>
      <trkpt lon="-73.5492324829101562" lat="41.0707969665527344">
        <ele>-6.0</ele>
        <time>2015-11-25T23:51:26.000Z</time>
      </trkpt>
      <trkpt lon="-73.5492477416992188" lat="41.0706977844238281">
        <ele>-4.0</ele>
        <time>2015-11-25T23:51:28.000Z</time>
      </trkpt>
      <trkpt lon="-73.5492630004882812" lat="41.0706176757812500">
        <ele>-3.0</ele>
        <time>2015-11-25T23:51:30.000Z</time>
      </trkpt>
      <trkpt lon="-73.5492782592773438" lat="41.0705528259277344">
        <ele>-2.0</ele>
        <time>2015-11-25T23:51:32.000Z</time>
      </trkpt>
      <trkpt lon="-73.5492782592773438" lat="41.0705528259277344">
        <ele>-2.0</ele>
        <time>2015-11-25T23:51:34.000Z</time>
      </trkpt>
      <trkpt lon="-73.5492782592773438" lat="41.0705528259277344">
        <ele>-2.0</ele>
        <time>2015-11-25T23:51:36.000Z</time>
      </trkpt>
      <trkpt lon="-73.5492782592773438" lat="41.0705528259277344">
        <ele>-2.0</ele>
        <time>2015-11-25T23:51:38.000Z</time>
      </trkpt>
      <trkpt lon="-73.5492782592773438" lat="41.0705528259277344">
        <ele>-2.0</ele>
        <time>2015-11-25T23:51:44.000Z</time>
      </trkpt>
      <trkpt lon="-73.5492782592773438" lat="41.0705528259277344">
        <ele>-2.0</ele>
        <time>2015-11-25T23:51:46.000Z</time>
      </trkpt>
      <trkpt lon="-73.5492782592773438" lat="41.0705528259277344">
        <ele>-2.0</ele>
        <time>2015-11-25T23:51:48.000Z</time>
      </trkpt>
      <trkpt lon="-73.5492706298828125" lat="41.0702285766601562">
        <ele>-7.0</ele>
        <time>2015-11-25T23:51:52.000Z</time>
      </trkpt>
      <trkpt lon="-73.5492477416992188" lat="41.0700454711914062">
        <ele>-9.0</ele>
        <time>2015-11-25T23:51:54.000Z</time>
      </trkpt>
      <trkpt lon="-73.5492095947265625" lat="41.0699272155761719">
        <ele>-10.0</ele>
        <time>2015-11-25T23:51:56.000Z</time>
      </trkpt>
      <trkpt lon="-73.5491638183593750" lat="41.0698471069335938">
        <ele>-11.0</ele>
        <time>2015-11-25T23:51:58.000Z</time>
      </trkpt>
      <trkpt lon="-73.5491180419921875" lat="41.0697822570800781">
        <ele>-11.0</ele>
        <time>2015-11-25T23:52:00.000Z</time>
      </trkpt>
      <trkpt lon="-73.5490570068359375" lat="41.0696449279785156">
        <ele>-12.0</ele>
        <time>2015-11-25T23:52:02.000Z</time>
      </trkpt>
      <trkpt lon="-73.5489807128906250" lat="41.0695304870605469">
        <ele>-11.0</ele>
        <time>2015-11-25T23:52:06.000Z</time>
      </trkpt>
      <trkpt lon="-73.5489807128906250" lat="41.0695304870605469">
        <ele>-11.0</ele>
        <time>2015-11-25T23:52:08.000Z</time>
      </trkpt>
      <trkpt lon="-73.5489807128906250" lat="41.0695304870605469">
        <ele>-11.0</ele>
        <time>2015-11-25T23:52:10.000Z</time>
      </trkpt>
      <trkpt lon="-73.5489807128906250" lat="41.0695304870605469">
        <ele>-11.0</ele>
        <time>2015-11-25T23:52:12.000Z</time>
      </trkpt>
      <trkpt lon="-73.5489807128906250" lat="41.0695304870605469">
        <ele>-11.0</ele>
        <time>2015-11-25T23:52:14.000Z</time>
      </trkpt>
      <trkpt lon="-73.5489807128906250" lat="41.0695304870605469">
        <ele>-11.0</ele>
        <time>2015-11-25T23:52:18.000Z</time>
      </trkpt>
      <trkpt lon="-73.5489807128906250" lat="41.0695304870605469">
        <ele>-11.0</ele>
        <time>2015-11-25T23:52:20.000Z</time>
      </trkpt>
      <trkpt lon="-73.5486679077148438" lat="41.0691070556640625">
        <ele>-12.0</ele>
        <time>2015-11-25T23:52:24.000Z</time>
      </trkpt>
      <trkpt lon="-73.5486679077148438" lat="41.0691070556640625">
        <ele>-12.0</ele>
        <time>2015-11-25T23:52:26.000Z</time>
      </trkpt>
      <trkpt lon="-73.5485382080078125" lat="41.0689544677734375">
        <ele>-7.0</ele>
        <time>2015-11-25T23:52:28.000Z</time>
      </trkpt>
      <trkpt lon="-73.5484466552734375" lat="41.0688362121582031">
        <ele>-12.0</ele>
        <time>2015-11-25T23:52:33.000Z</time>
      </trkpt>
      <trkpt lon="-73.5484466552734375" lat="41.0688362121582031">
        <ele>-12.0</ele>
        <time>2015-11-25T23:52:35.000Z</time>
      </trkpt>
      <trkpt lon="-73.5484466552734375" lat="41.0688362121582031">
        <ele>-12.0</ele>
        <time>2015-11-25T23:52:37.000Z</time>
      </trkpt>
      <trkpt lon="-73.5484466552734375" lat="41.0688362121582031">
        <ele>-12.0</ele>
        <time>2015-11-25T23:52:39.000Z</time>
      </trkpt>
      <trkpt lon="-73.5481491088867188" lat="41.0685958862304688">
        <ele>-12.0</ele>
        <time>2015-11-25T23:52:45.000Z</time>
      </trkpt>
      <trkpt lon="-73.5480728149414062" lat="41.0685043334960938">
        <ele>-13.0</ele>
        <time>2015-11-25T23:52:49.000Z</time>
      </trkpt>
      <trkpt lon="-73.5480728149414062" lat="41.0685043334960938">
        <ele>-13.0</ele>
        <time>2015-11-25T23:52:51.000Z</time>
      </trkpt>
      <trkpt lon="-73.5480728149414062" lat="41.0685043334960938">
        <ele>-13.0</ele>
        <time>2015-11-25T23:52:53.000Z</time>
      </trkpt>
      <trkpt lon="-73.5480728149414062" lat="41.0685043334960938">
        <ele>-13.0</ele>
        <time>2015-11-25T23:52:55.000Z</time>
      </trkpt>
      <trkpt lon="-73.5478973388671875" lat="41.0683746337890625">
        <ele>-10.0</ele>
        <time>2015-11-25T23:52:57.000Z</time>
      </trkpt>
      <trkpt lon="-73.5478973388671875" lat="41.0683746337890625">
        <ele>-10.0</ele>
        <time>2015-11-25T23:52:59.000Z</time>
      </trkpt>
      <trkpt lon="-73.5477752685546875" lat="41.0682830810546875">
        <ele>-10.0</ele>
        <time>2015-11-25T23:53:01.000Z</time>
      </trkpt>
      <trkpt lon="-73.5477752685546875" lat="41.0682830810546875">
        <ele>-10.0</ele>
        <time>2015-11-25T23:53:03.000Z</time>
      </trkpt>
      <trkpt lon="-73.5476379394531250" lat="41.0681571960449219">
        <ele>-14.0</ele>
        <time>2015-11-25T23:53:07.000Z</time>
      </trkpt>
      <trkpt lon="-73.5476379394531250" lat="41.0681571960449219">
        <ele>-14.0</ele>
        <time>2015-11-25T23:53:11.000Z</time>
      </trkpt>
      <trkpt lon="-73.5474395751953125" lat="41.0680580139160156">
        <ele>-20.0</ele>
        <time>2015-11-25T23:53:13.000Z</time>
      </trkpt>
      <trkpt lon="-73.5474395751953125" lat="41.0680580139160156">
        <ele>-20.0</ele>
        <time>2015-11-25T23:53:15.000Z</time>
      </trkpt>
      <trkpt lon="-73.5474395751953125" lat="41.0680580139160156">
        <ele>-20.0</ele>
        <time>2015-11-25T23:53:17.000Z</time>
      </trkpt>
      <trkpt lon="-73.5471801757812500" lat="41.0679321289062500">
        <ele>-20.0</ele>
        <time>2015-11-25T23:53:21.000Z</time>
      </trkpt>
      <trkpt lon="-73.5471801757812500" lat="41.0679321289062500">
        <ele>-20.0</ele>
        <time>2015-11-25T23:53:25.000Z</time>
      </trkpt>
      <trkpt lon="-73.5471801757812500" lat="41.0679321289062500">
        <ele>-20.0</ele>
        <time>2015-11-25T23:53:27.000Z</time>
      </trkpt>
      <trkpt lon="-73.5471801757812500" lat="41.0679321289062500">
        <ele>-20.0</ele>
        <time>2015-11-25T23:53:29.000Z</time>
      </trkpt>
      <trkpt lon="-73.5471801757812500" lat="41.0679321289062500">
        <ele>-20.0</ele>
        <time>2015-11-25T23:53:31.000Z</time>
      </trkpt>
      <trkpt lon="-73.5471801757812500" lat="41.0679321289062500">
        <ele>-20.0</ele>
        <time>2015-11-25T23:53:33.000Z</time>
      </trkpt>
      <trkpt lon="-73.5469284057617188" lat="41.0678291320800781">
        <ele>-12.0</ele>
        <time>2015-11-25T23:53:39.000Z</time>
      </trkpt>
      <trkpt lon="-73.5467758178710938" lat="41.0677642822265625">
        <ele>-13.0</ele>
        <time>2015-11-25T23:53:41.000Z</time>
      </trkpt>
      <trkpt lon="-73.5466613769531250" lat="41.0677185058593750">
        <ele>-13.0</ele>
        <time>2015-11-25T23:53:43.000Z</time>
      </trkpt>
      <trkpt lon="-73.5465850830078125" lat="41.0676651000976562">
        <ele>-13.0</ele>
        <time>2015-11-25T23:53:45.000Z</time>
      </trkpt>
      <trkpt lon="-73.5465850830078125" lat="41.0676651000976562">
        <ele>-13.0</ele>
        <time>2015-11-25T23:53:47.000Z</time>
      </trkpt>
      <trkpt lon="-73.5465850830078125" lat="41.0676651000976562">
        <ele>-13.0</ele>
        <time>2015-11-25T23:53:49.000Z</time>
      </trkpt>
      <trkpt lon="-73.5465850830078125" lat="41.0676651000976562">
        <ele>-13.0</ele>
        <time>2015-11-25T23:53:51.000Z</time>
      </trkpt>
      <trkpt lon="-73.5464172363281250" lat="41.0675430297851562">
        <ele>-15.0</ele>
        <time>2015-11-25T23:53:55.000Z</time>
      </trkpt>
      <trkpt lon="-73.5463027954101562" lat="41.0674552917480469">
        <ele>-14.0</ele>
        <time>2015-11-25T23:53:57.000Z</time>
      </trkpt>
      <trkpt lon="-73.5463027954101562" lat="41.0674552917480469">
        <ele>-14.0</ele>
        <time>2015-11-25T23:53:59.000Z</time>
      </trkpt>
      <trkpt lon="-73.5461883544921875" lat="41.0673675537109375">
        <ele>-15.0</ele>
        <time>2015-11-25T23:54:01.000Z</time>
      </trkpt>
      <trkpt lon="-73.5461044311523438" lat="41.0673103332519531">
        <ele>-14.0</ele>
        <time>2015-11-25T23:54:03.000Z</time>
      </trkpt>
      <trkpt lon="-73.5461044311523438" lat="41.0673103332519531">
        <ele>-14.0</ele>
        <time>2015-11-25T23:54:05.000Z</time>
      </trkpt>
      <trkpt lon="-73.5461044311523438" lat="41.0673103332519531">
        <ele>-14.0</ele>
        <time>2015-11-25T23:54:07.000Z</time>
      </trkpt>
      <trkpt lon="-73.5461044311523438" lat="41.0673103332519531">
        <ele>-14.0</ele>
        <time>2015-11-25T23:54:13.000Z</time>
      </trkpt>
      <trkpt lon="-73.5461044311523438" lat="41.0673103332519531">
        <ele>-14.0</ele>
        <time>2015-11-25T23:54:15.000Z</time>
      </trkpt>
      <trkpt lon="-73.5458755493164062" lat="41.0671691894531250">
        <ele>-9.0</ele>
        <time>2015-11-25T23:54:17.000Z</time>
      </trkpt>
      <trkpt lon="-73.5457229614257812" lat="41.0670852661132812">
        <ele>-7.0</ele>
        <time>2015-11-25T23:54:19.000Z</time>
      </trkpt>
      <trkpt lon="-73.5456314086914062" lat="41.0670204162597656">
        <ele>-7.0</ele>
        <time>2015-11-25T23:54:21.000Z</time>
      </trkpt>
      <trkpt lon="-73.5455780029296875" lat="41.0669708251953125">
        <ele>-8.0</ele>
        <time>2015-11-25T23:54:23.000Z</time>
      </trkpt>
      <trkpt lon="-73.5455780029296875" lat="41.0669708251953125">
        <ele>-8.0</ele>
        <time>2015-11-25T23:54:25.000Z</time>
      </trkpt>
      <trkpt lon="-73.5455780029296875" lat="41.0669708251953125">
        <ele>-8.0</ele>
        <time>2015-11-25T23:54:27.000Z</time>
      </trkpt>
      <trkpt lon="-73.5454330444335938" lat="41.0668678283691406">
        <ele>-13.0</ele>
        <time>2015-11-25T23:54:31.000Z</time>
      </trkpt>
      <trkpt lon="-73.5453262329101562" lat="41.0667953491210938">
        <ele>-14.0</ele>
        <time>2015-11-25T23:54:33.000Z</time>
      </trkpt>
      <trkpt lon="-73.5452194213867188" lat="41.0667495727539062">
        <ele>-15.0</ele>
        <time>2015-11-25T23:54:35.000Z</time>
      </trkpt>
      <trkpt lon="-73.5451660156250000" lat="41.0666923522949219">
        <ele>-19.0</ele>
        <time>2015-11-25T23:54:37.000Z</time>
      </trkpt>
      <trkpt lon="-73.5451660156250000" lat="41.0666923522949219">
        <ele>-19.0</ele>
        <time>2015-11-25T23:54:39.000Z</time>
      </trkpt>
      <trkpt lon="-73.5451660156250000" lat="41.0666923522949219">
        <ele>-19.0</ele>
        <time>2015-11-25T23:54:41.000Z</time>
      </trkpt>
      <trkpt lon="-73.5450668334960938" lat="41.0666389465332031">
        <ele>-17.0</ele>
        <time>2015-11-25T23:54:46.000Z</time>
      </trkpt>
      <trkpt lon="-73.5450057983398438" lat="41.0665702819824219">
        <ele>-17.0</ele>
        <time>2015-11-25T23:54:48.000Z</time>
      </trkpt>
      <trkpt lon="-73.5449600219726562" lat="41.0665092468261719">
        <ele>-14.0</ele>
        <time>2015-11-25T23:54:50.000Z</time>
      </trkpt>
      <trkpt lon="-73.5449142456054688" lat="41.0664558410644531">
        <ele>-14.0</ele>
        <time>2015-11-25T23:54:52.000Z</time>
      </trkpt>
      <trkpt lon="-73.5449142456054688" lat="41.0664558410644531">
        <ele>-14.0</ele>
        <time>2015-11-25T23:54:54.000Z</time>
      </trkpt>
      <trkpt lon="-73.5449142456054688" lat="41.0664558410644531">
        <ele>-14.0</ele>
        <time>2015-11-25T23:54:56.000Z</time>
      </trkpt>
      <trkpt lon="-73.5449142456054688" lat="41.0664558410644531">
        <ele>-14.0</ele>
        <time>2015-11-25T23:55:00.000Z</time>
      </trkpt>
      <trkpt lon="-73.5449142456054688" lat="41.0664558410644531">
        <ele>-14.0</ele>
        <time>2015-11-25T23:55:02.000Z</time>
      </trkpt>
      <trkpt lon="-73.5449142456054688" lat="41.0664558410644531">
        <ele>-14.0</ele>
        <time>2015-11-25T23:55:04.000Z</time>
      </trkpt>
      <trkpt lon="-73.5449142456054688" lat="41.0664558410644531">
        <ele>-14.0</ele>
        <time>2015-11-25T23:55:06.000Z</time>
      </trkpt>
      <trkpt lon="-73.5446548461914062" lat="41.0662231445312500">
        <ele>-20.0</ele>
        <time>2015-11-25T23:55:12.000Z</time>
      </trkpt>
      <trkpt lon="-73.5445022583007812" lat="41.0660858154296875">
        <ele>-21.0</ele>
        <time>2015-11-25T23:55:14.000Z</time>
      </trkpt>
      <trkpt lon="-73.5444107055664062" lat="41.0659980773925781">
        <ele>-20.0</ele>
        <time>2015-11-25T23:55:16.000Z</time>
      </trkpt>
      <trkpt lon="-73.5443496704101562" lat="41.0659255981445312">
        <ele>-19.0</ele>
        <time>2015-11-25T23:55:18.000Z</time>
      </trkpt>
      <trkpt lon="-73.5442810058593750" lat="41.0658531188964844">
        <ele>-18.0</ele>
        <time>2015-11-25T23:55:20.000Z</time>
      </trkpt>
      <trkpt lon="-73.5441741943359375" lat="41.0657348632812500">
        <ele>-18.0</ele>
        <time>2015-11-25T23:55:22.000Z</time>
      </trkpt>
      <trkpt lon="-73.5441741943359375" lat="41.0657348632812500">
        <ele>-18.0</ele>
        <time>2015-11-25T23:55:24.000Z</time>
      </trkpt>
      <trkpt lon="-73.5441741943359375" lat="41.0657348632812500">
        <ele>-18.0</ele>
        <time>2015-11-25T23:55:26.000Z</time>
      </trkpt>
      <trkpt lon="-73.5441741943359375" lat="41.0657348632812500">
        <ele>-18.0</ele>
        <time>2015-11-25T23:55:28.000Z</time>
      </trkpt>
      <trkpt lon="-73.5440216064453125" lat="41.0654678344726562">
        <ele>-22.0</ele>
        <time>2015-11-25T23:55:32.000Z</time>
      </trkpt>
      <trkpt lon="-73.5440216064453125" lat="41.0654678344726562">
        <ele>-22.0</ele>
        <time>2015-11-25T23:55:34.000Z</time>
      </trkpt>
      <trkpt lon="-73.5440216064453125" lat="41.0654678344726562">
        <ele>-22.0</ele>
        <time>2015-11-25T23:55:36.000Z</time>
      </trkpt>
      <trkpt lon="-73.5440216064453125" lat="41.0654678344726562">
        <ele>-22.0</ele>
        <time>2015-11-25T23:55:38.000Z</time>
      </trkpt>
      <trkpt lon="-73.5440216064453125" lat="41.0654678344726562">
        <ele>-22.0</ele>
        <time>2015-11-25T23:55:40.000Z</time>
      </trkpt>
      <trkpt lon="-73.5440216064453125" lat="41.0654678344726562">
        <ele>-22.0</ele>
        <time>2015-11-25T23:55:46.000Z</time>
      </trkpt>
      <trkpt lon="-73.5440216064453125" lat="41.0654678344726562">
        <ele>-22.0</ele>
        <time>2015-11-25T23:55:48.000Z</time>
      </trkpt>
      <trkpt lon="-73.5440216064453125" lat="41.0654678344726562">
        <ele>-22.0</ele>
        <time>2015-11-25T23:56:02.000Z</time>
      </trkpt>
      <trkpt lon="-73.5440216064453125" lat="41.0654678344726562">
        <ele>-22.0</ele>
        <time>2015-11-25T23:56:04.000Z</time>
      </trkpt>
      <trkpt lon="-73.5440216064453125" lat="41.0654678344726562">
        <ele>-22.0</ele>
        <time>2015-11-25T23:56:06.000Z</time>
      </trkpt>
      <trkpt lon="-73.5440216064453125" lat="41.0654678344726562">
        <ele>-22.0</ele>
        <time>2015-11-25T23:56:08.000Z</time>
      </trkpt>
      <trkpt lon="-73.5435562133789062" lat="41.0652923583984375">
        <ele>-18.0</ele>
        <time>2015-11-25T23:56:10.000Z</time>
      </trkpt>
      <trkpt lon="-73.5433959960937500" lat="41.0653533935546875">
        <ele>-15.0</ele>
        <time>2015-11-25T23:56:14.000Z</time>
      </trkpt>
      <trkpt lon="-73.5433959960937500" lat="41.0653533935546875">
        <ele>-15.0</ele>
        <time>2015-11-25T23:56:16.000Z</time>
      </trkpt>
      <trkpt lon="-73.5432662963867188" lat="41.0653686523437500">
        <ele>-17.0</ele>
        <time>2015-11-25T23:56:18.000Z</time>
      </trkpt>
      <trkpt lon="-73.5431671142578125" lat="41.0654029846191406">
        <ele>-17.0</ele>
        <time>2015-11-25T23:56:20.000Z</time>
      </trkpt>
      <trkpt lon="-73.5430831909179688" lat="41.0654373168945312">
        <ele>-14.0</ele>
        <time>2015-11-25T23:56:22.000Z</time>
      </trkpt>
      <trkpt lon="-73.5430831909179688" lat="41.0654373168945312">
        <ele>-14.0</ele>
        <time>2015-11-25T23:56:24.000Z</time>
      </trkpt>
      <trkpt lon="-73.5429382324218750" lat="41.0654907226562500">
        <ele>-15.0</ele>
        <time>2015-11-25T23:56:26.000Z</time>
      </trkpt>
      <trkpt lon="-73.5429382324218750" lat="41.0654907226562500">
        <ele>-15.0</ele>
        <time>2015-11-25T23:56:28.000Z</time>
      </trkpt>
      <trkpt lon="-73.5429382324218750" lat="41.0654907226562500">
        <ele>-15.0</ele>
        <time>2015-11-25T23:56:30.000Z</time>
      </trkpt>
      <trkpt lon="-73.5429382324218750" lat="41.0654907226562500">
        <ele>-15.0</ele>
        <time>2015-11-25T23:56:32.000Z</time>
      </trkpt>
      <trkpt lon="-73.5429382324218750" lat="41.0654907226562500">
        <ele>-15.0</ele>
        <time>2015-11-25T23:56:34.000Z</time>
      </trkpt>
      <trkpt lon="-73.5429382324218750" lat="41.0654907226562500">
        <ele>-15.0</ele>
        <time>2015-11-25T23:56:36.000Z</time>
      </trkpt>
      <trkpt lon="-73.5427017211914062" lat="41.0655784606933594">
        <ele>-11.0</ele>
        <time>2015-11-25T23:56:38.000Z</time>
      </trkpt>
      <trkpt lon="-73.5425415039062500" lat="41.0656318664550781">
        <ele>-13.0</ele>
        <time>2015-11-25T23:56:40.000Z</time>
      </trkpt>
      <trkpt lon="-73.5424270629882812" lat="41.0656661987304688">
        <ele>-14.0</ele>
        <time>2015-11-25T23:56:42.000Z</time>
      </trkpt>
      <trkpt lon="-73.5423355102539062" lat="41.0657119750976562">
        <ele>-23.0</ele>
        <time>2015-11-25T23:56:44.000Z</time>
      </trkpt>
      <trkpt lon="-73.5422439575195312" lat="41.0657386779785156">
        <ele>-23.0</ele>
        <time>2015-11-25T23:56:47.000Z</time>
      </trkpt>
      <trkpt lon="-73.5420837402343750" lat="41.0657920837402344">
        <ele>-23.0</ele>
        <time>2015-11-25T23:56:49.000Z</time>
      </trkpt>
      <trkpt lon="-73.5420837402343750" lat="41.0657920837402344">
        <ele>-23.0</ele>
        <time>2015-11-25T23:56:51.000Z</time>
      </trkpt>
      <trkpt lon="-73.5420837402343750" lat="41.0657920837402344">
        <ele>-23.0</ele>
        <time>2015-11-25T23:56:53.000Z</time>
      </trkpt>
      <trkpt lon="-73.5420837402343750" lat="41.0657920837402344">
        <ele>-23.0</ele>
        <time>2015-11-25T23:56:55.000Z</time>
      </trkpt>
      <trkpt lon="-73.5420837402343750" lat="41.0657920837402344">
        <ele>-23.0</ele>
        <time>2015-11-25T23:56:57.000Z</time>
      </trkpt>
      <trkpt lon="-73.5420837402343750" lat="41.0657920837402344">
        <ele>-23.0</ele>
        <time>2015-11-25T23:56:59.000Z</time>
      </trkpt>
      <trkpt lon="-73.5416793823242188" lat="41.0657997131347656">
        <ele>-17.0</ele>
        <time>2015-11-25T23:57:28.000Z</time>
      </trkpt>
      <trkpt lon="-73.5415420532226562" lat="41.0658416748046875">
        <ele>-15.0</ele>
        <time>2015-11-25T23:57:31.000Z</time>
      </trkpt>
      <trkpt lon="-73.5415420532226562" lat="41.0658416748046875">
        <ele>-15.0</ele>
        <time>2015-11-25T23:57:33.000Z</time>
      </trkpt>
      <trkpt lon="-73.5415420532226562" lat="41.0658416748046875">
        <ele>-15.0</ele>
        <time>2015-11-25T23:57:35.000Z</time>
      </trkpt>
      <trkpt lon="-73.5415420532226562" lat="41.0658416748046875">
        <ele>-15.0</ele>
        <time>2015-11-25T23:57:37.000Z</time>
      </trkpt>
      <trkpt lon="-73.5415420532226562" lat="41.0658416748046875">
        <ele>-15.0</ele>
        <time>2015-11-25T23:57:39.000Z</time>
      </trkpt>
      <trkpt lon="-73.5415420532226562" lat="41.0658416748046875">
        <ele>-15.0</ele>
        <time>2015-11-25T23:57:43.000Z</time>
      </trkpt>
      <trkpt lon="-73.5415420532226562" lat="41.0658416748046875">
        <ele>-15.0</ele>
        <time>2015-11-25T23:57:43.000Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>


