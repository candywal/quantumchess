# Deployment Guide for Quantum Chess

This guide will walk you through deploying your Quantum Chess game to Render.

## Prerequisites

1. A GitHub account
2. A Render account (free - sign up at [render.com](https://render.com))
3. Your code pushed to a GitHub repository

## Step-by-Step Deployment

### 1. Push Code to GitHub

If you haven't already:

```bash
cd /Users/candywal/Documents/Random/quantumchess/quantumchess
git init
git add .
git commit -m "Initial commit: Quantum Chess game"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/quantum-chess.git
git push -u origin main
```

### 2. Deploy to Render

#### Option A: Automatic Deployment (Recommended)

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click the "New +" button in the top right
3. Select "Web Service"
4. Click "Connect GitHub" and authorize Render
5. Find and select your `quantum-chess` repository
6. Render will automatically detect the `render.yaml` file
7. Click "Apply" to use the configuration
8. Click "Create Web Service"
9. Wait for the deployment (usually 2-3 minutes)
10. Your app will be live at `https://YOUR-APP-NAME.onrender.com`

#### Option B: Manual Configuration

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "Web Service"
3. Connect your repository
4. Fill in the following:
   - **Name**: `quantum-chess` (or your preferred name)
   - **Environment**: `Node`
   - **Region**: Choose closest to you
   - **Branch**: `main`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. Click "Create Web Service"

### 3. Wait for Deployment

- The build process will install dependencies
- Once complete, Render will start your server
- You'll see "Quantum Chess server running on port XXXX" in the logs
- The app will be accessible at your Render URL

### 4. Test Your Deployment

1. Visit your Render URL (e.g., `https://quantum-chess-abc123.onrender.com`)
2. Click "Create New Game"
3. Copy the game link
4. Open it in another browser/tab
5. Start playing!

## Important Notes

### Free Tier Limitations

- **Sleep after inactivity**: Apps on the free tier sleep after 15 minutes of no traffic
- **Wake time**: First request after sleeping takes ~30 seconds
- **Hours limit**: 750 hours per month (sufficient for 1-2 players)
- **Automatic shut down**: If you exceed hours, the app stops until next month

### Custom Domain (Optional)

If you want a custom domain:

1. Go to your service settings in Render
2. Click "Custom Domain"
3. Follow instructions to configure DNS
4. Render provides free SSL certificates automatically

### Environment Variables

If you need to add environment variables:

1. Go to your service in Render
2. Navigate to "Environment"
3. Add variables (e.g., `NODE_ENV=production`)

### Monitoring

- View logs in real-time from the Render dashboard
- Monitor uptime and performance
- Set up notifications for deployments

## Troubleshooting

### Build Fails

- Check that `package.json` is in the root directory
- Verify all dependencies are listed in `package.json`
- Check build logs for specific errors

### App Won't Start

- Verify `server.js` exists in root directory
- Check that `PORT` is read from `process.env.PORT`
- Review application logs in Render dashboard

### WebSocket Issues

- Ensure Socket.io is properly configured
- Check that the client connects to the correct URL
- Verify no firewall/proxy blocking WebSocket connections

### Can't Connect to Game

- Verify the service is running (check Render dashboard)
- Make sure you're using the correct Render URL
- Check browser console for errors
- Try opening the URL in incognito mode

## Updating Your Deployment

To deploy updates:

```bash
git add .
git commit -m "Description of changes"
git push origin main
```

Render will automatically detect the push and redeploy your app.

## Alternative: Local Network Deployment

If you want to host from your computer for a local network game:

1. Find your local IP address:
   - Mac: `ifconfig | grep "inet " | grep -v 127.0.0.1`
   - Windows: `ipconfig`
2. Start the server: `npm start`
3. Share the link: `http://YOUR_LOCAL_IP:3000`
4. Other players on the same WiFi can access it

## Alternative: Tunneling (ngrok)

For temporary internet access from your computer:

1. Install ngrok: https://ngrok.com/download
2. Start your server: `npm start`
3. In another terminal: `ngrok http 3000`
4. Share the ngrok URL (e.g., `https://abc123.ngrok.io`)
5. This link works for anyone on the internet

Note: Free ngrok tunnels expire after a few hours and the URL changes each time.

## Support

For issues with:
- **Render deployment**: Check [Render docs](https://render.com/docs)
- **Game functionality**: Review the code in `server.js` and `game.js`
- **Connection issues**: Check browser console and Render logs

## Cost Estimates

- **Render Free Tier**: $0/month (750 hours)
- **Render Starter Tier**: $7/month (always on, better performance)
- **Custom domain**: Free with Render, domain purchase separate (~$10/year)

Enjoy your Quantum Chess game! 🎮⚛️

