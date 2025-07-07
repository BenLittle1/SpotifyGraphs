# Spotify Graphs 🎵

A beautiful web application that visualizes your Spotify listening data as interactive network graphs with neon aesthetics.

## 🚀 Deployment Status
✅ **Live at Railway** - Connected to GitHub for auto-deployment

## Features

- **Multiple Visualization Types**: 
  - Top Tracks Network
  - Genre Map
  - Artist Network  
  - Discovery Path
  
- **Interactive Graphs**: Powered by D3-force with drag, zoom, and click interactions
- **Neon Aesthetic**: Dark theme with vibrant neon colors
- **Secure Authentication**: OAuth2 with Spotify
- **Responsive Design**: Works on desktop and tablet devices

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Visualization**: D3.js, D3-force
- **Styling**: Tailwind CSS
- **Authentication**: NextAuth.js
- **API**: Spotify Web API
- **Deployment**: Railway

## Getting Started

### Prerequisites

1. Node.js 18+ installed
2. A Spotify Developer account
3. Railway account (for deployment)

### Spotify App Setup

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click "Create App"
3. Fill in the app details:
   - App name: "Spotify Graphs"
   - App description: "Visualize your music taste"
   - Redirect URIs: 
     - `http://localhost:3000/api/auth/callback/spotify` (development)
     - `https://your-app-name.up.railway.app/api/auth/callback/spotify` (production)
4. Save your Client ID and Client Secret

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/yourusername/spotify-graphs.git
cd spotify-graphs
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on `env.example`:
```bash
cp env.example .env
```

4. Fill in your environment variables:
```env
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate_a_random_string_here
```

To generate NEXTAUTH_SECRET:
```bash
openssl rand -base64 32
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000)

## Deployment on Railway

### Easy Deploy

1. Click the "Deploy on Railway" button below
2. Configure environment variables in Railway dashboard
3. Add your production redirect URI to Spotify app settings

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/deploy)

### Manual Deploy

1. Install Railway CLI:
```bash
npm install -g @railway/cli
```

2. Login to Railway:
```bash
railway login
```

3. Create a new project:
```bash
railway init
```

4. Add environment variables in Railway dashboard:
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
   - `NEXTAUTH_URL` (set to your Railway app URL)
   - `NEXTAUTH_SECRET`

5. Deploy:
```bash
railway up
```

6. Update your Spotify app's redirect URI with your Railway URL

## Project Structure

```
spotify-graphs/
├── app/
│   ├── api/auth/        # NextAuth configuration
│   ├── components/      # React components
│   ├── dashboard/       # Dashboard pages
│   ├── lib/            # Utilities and API clients
│   └── types/          # TypeScript types
├── styles/             # Global styles
├── public/             # Static assets
└── package.json        # Dependencies
```

## Error Handling

The app includes comprehensive error handling for:
- Spotify API rate limits (with automatic retry)
- Token refresh failures
- Network errors
- Empty data states

## Performance

- Graph limited to ~200 nodes for optimal performance
- Lazy loading of visualizations
- Efficient data processing algorithms

## Contributing

Pull requests are welcome! For major changes, please open an issue first.

## License

MIT 