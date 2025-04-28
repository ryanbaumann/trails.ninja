# trails.ninja "Strava Explorer" app



Deployed app at: https://s3.us-west-1.amazonaws.com/www.trails.ninja/index.html

# Description
A web application for users to connect to their Strava accounts, pull activities, make 3D interactive visualizations using Mapbox GL JS, and save the results as beautiful high-resolution images for print and art display.

# Local Development Setup

1.  **Install Dependencies:**
    ```bash
    npm install
    ```
2.  **Configure Environment Variables:**
    *   Create a file named `.env` in the `strava-explorer` directory.
    *   Add the following variables, replacing the placeholders with your actual credentials:
        ```dotenv
        VITE_STRAVA_CLIENT_ID=YOUR_STRAVA_CLIENT_ID
        VITE_STRAVA_CLIENT_SECRET=YOUR_STRAVA_CLIENT_SECRET
        VITE_MAPBOX_ACCESS_TOKEN=YOUR_MAPBOX_ACCESS_TOKEN
        ```
    *   **Important:** Ensure the `.env` file is listed in your root `.gitignore` file to prevent committing secrets.
3.  **Configure Strava API Application:**
    *   Go to your Strava API Application settings: [https://www.strava.com/settings/api](https://www.strava.com/settings/api)
    *   Set the "Authorization Callback Domain" or "Redirect URI" to match the Vite development server URL (usually `http://localhost:5173/` or similar - check the terminal output when running `npm run dev`).
4.  **Run Development Server:**
    ```bash
    npm run dev
    ```
    This will start the Vite development server and open the application in your browser.

# Build for Production
```bash
npm run build
```
This command builds the application for production in the `dist` directory (Vite's default). You can then deploy the contents of the `dist` directory.
