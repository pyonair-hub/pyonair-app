# Pyonair Mobile App

**Your AI Team. On your phone.**

React Native app for iOS and Android that gives clients native access to their Pyonair AI team.

## What It Does

- Opens the Pyonair portal (app.pyonair.com) in a native WebView
- Push notifications when your AI team has updates
- Pyonair branded splash screen and app icon
- Offline error handling with auto-retry
- Pull to refresh
- Android back button navigation
- External links open in system browser

## Tech Stack

- **Framework**: React Native via Expo SDK 54
- **Navigation**: WebView (react-native-webview)
- **Notifications**: expo-notifications
- **Auth**: expo-local-authentication (biometric)
- **Build**: EAS Build (Expo Application Services)

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npx expo start

# Run on iOS simulator
npx expo run:ios

# Run on Android emulator
npx expo run:android
```

## Building for App Store / Google Play

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

## Requirements for Store Submission

- **Apple Developer Account** ($99/year) - developer.apple.com
- **Google Play Developer Account** ($25 one-time) - play.google.com/console

## Project Structure

```
pyonair-app/
  App.js              # Main app component (WebView wrapper)
  app.json            # Expo configuration
  assets/
    icon.png          # App Store icon (1024x1024)
    adaptive-icon.png # Android adaptive icon
    splash-icon.png   # Splash screen logo
    favicon.png       # Web favicon
    notification-icon.png # Android notification icon
```

## Configuration

The app points to `https://app.pyonair.com` by default. Change `PORTAL_BASE_URL` in App.js to point to a different portal instance.

## Brand

- Navy: #0F172A
- Red: #E63946
- Font: Inter (loaded by the portal WebView)
