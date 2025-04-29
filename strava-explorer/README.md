# Strava Explorer

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Description

A web application enabling users to connect their Strava accounts, retrieve activities, and generate interactive 3D visualizations using Google Maps Platform. Users can save these visualizations as high-resolution images suitable for print and display.

## Features

*   Secure Strava OAuth2 authentication.
*   Fetches user's Strava activities.
*   Renders activities as interactive 3D polylines on a map.
*   Utilizes Google Maps Platform for mapping and visualization.
*   Option to export visualizations as high-resolution images.

## Tech Stack

*   **Frontend:** Vanilla JavaScript, HTML, CSS
*   **Build Tool:** Vite
*   **Mapping:** Google Maps Platform (Photorealistic 3D Tiles, Maps JavaScript API)
*   **API:** Strava V3 API

## Local Development Setup

1.  **Clone the Repository:**
    ```bash
    git clone <repository-url>
    cd strava-explorer
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    # or
    # yarn install
    ```

3.  **Configure Environment Variables:**
    *   Create a file named `.env.development` in the `strava-explorer` directory.
    *   Add the following variables, replacing the placeholders with your actual credentials:
        ```dotenv
        # Strava API Credentials (https://www.strava.com/settings/api)
        VITE_STRAVA_CLIENT_ID=YOUR_STRAVA_CLIENT_ID
        VITE_STRAVA_CLIENT_SECRET=YOUR_STRAVA_CLIENT_SECRET

        # Google Maps Platform API Key (https://console.cloud.google.com/google/maps-apis/)
        # Ensure Maps JavaScript API & Photorealistic 3D Tiles are enabled
        VITE_GMP_API_KEY=YOUR_GOOGLE_MAPS_API_KEY

        # Optional: Google Maps Map ID for custom styling (https://console.cloud.google.com/google/maps-apis/)
        # VITE_GMP_MAP_ID=YOUR_GOOGLE_MAPS_MAP_ID
        ```
    *   **Important:** Ensure `.env.*` files are listed in your root `.gitignore` file to prevent committing secrets (e.g., `strava-explorer/.env*`).

4.  **Configure Strava API Application:**
    *   Go to your Strava API Application settings: [https://www.strava.com/settings/api](https://www.strava.com/settings/api)
    *   Set the "Authorization Callback Domain" to `localhost`.
    *   Add the development server URL (e.g., `http://localhost:5173/` or check terminal output) to the list of authorized "Redirect URIs".

5.  **Run Development Server:**
    ```bash
    npm run dev
    # or
    # yarn dev
    ```
    This will start the Vite development server (typically at `http://localhost:5173/`) and open the application in your browser.

## Build for Production

```bash
npm run build
# or
# yarn build
```
This command bundles the application for production into the `strava-explorer/build/` directory.

## Deployment

Deploy the static assets generated in the `strava-explorer/build/` directory to your preferred hosting provider (e.g., Google Cloud Storage, Netlify, Vercel, AWS S3). Ensure your production environment variables (e.g., in a `.env.production` file or hosting provider settings) and Strava API redirect URIs are configured correctly for your deployment domain.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. (Optional: Add more detailed contribution guidelines if desired).
