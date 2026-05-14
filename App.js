import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  BackHandler,
  Linking,
  Alert,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

// ─── Configuration ───────────────────────────────────────────────────────────
const PORTAL_BASE_URL = 'https://app.pyonair.com';
const BRAND = {
  navy: '#0F172A',
  red: '#E63946',
  white: '#FFFFFF',
  gray50: '#F8FAFC',
  gray400: '#94A3B8',
  gray500: '#64748B',
};

// Keep splash screen visible while we load
SplashScreen.preventAutoHideAsync();

// Configure notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ─── Push Notification Registration ──────────────────────────────────────────
async function registerForPushNotifications() {
  if (!Device.isDevice) {
    console.log('[Push] Must use physical device for push notifications');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Push] Permission not granted');
    return null;
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    });
    console.log('[Push] Token:', token.data);
    return token.data;
  } catch (e) {
    console.warn('[Push] Failed to get token:', e);
    return null;
  }
}

// ─── Main App Component ──────────────────────────────────────────────────────
export default function App() {
  const webViewRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [canGoBack, setCanGoBack] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(PORTAL_BASE_URL);
  const [pushToken, setPushToken] = useState(null);

  // ── Splash Screen ──
  const onLayoutRootView = useCallback(async () => {
    await SplashScreen.hideAsync();
  }, []);

  // ── Push Notifications ──
  useEffect(() => {
    registerForPushNotifications().then(token => {
      if (token) {
        setPushToken(token);
        // Send token to portal server
        fetch(`${PORTAL_BASE_URL}/api/push/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: token,
            platform: Platform.OS,
            device: Device.modelName,
          }),
        }).catch(e => console.warn('[Push] Subscribe failed:', e));
      }
    });

    // Handle notification taps
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const url = response.notification.request.content.data?.url;
      if (url && webViewRef.current) {
        webViewRef.current.injectJavaScript(`window.location.href='${url}';true;`);
      }
    });

    return () => sub.remove();
  }, []);

  // ── Android Back Button ──
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const onBack = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    };

    BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => BackHandler.removeEventListener('hardwareBackPress', onBack);
  }, [canGoBack]);

  // ── JavaScript to inject into WebView ──
  const injectedJS = `
    (function() {
      // Tell the portal it's running inside the native app
      window.__PYONAIR_NATIVE_APP = true;
      window.__PYONAIR_PLATFORM = '${Platform.OS}';

      // Override external link handling
      document.addEventListener('click', function(e) {
        var link = e.target.closest('a[href]');
        if (link && link.href) {
          var url = new URL(link.href);
          // Open external links in system browser
          if (url.origin !== window.location.origin &&
              !url.hostname.includes('pyonair') &&
              !url.hostname.includes('ai-civ')) {
            e.preventDefault();
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'external-link',
              url: link.href
            }));
          }
        }
      }, true);

      // Send page title changes
      var observer = new MutationObserver(function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'title',
          title: document.title
        }));
      });
      observer.observe(document.querySelector('title') || document.head, {
        subtree: true, characterData: true, childList: true
      });

      // Hide any web-only install prompts
      var style = document.createElement('style');
      style.textContent = '#pwa-install-banner, .pwa-install-prompt { display: none !important; }';
      document.head.appendChild(style);

      true;
    })();
  `;

  // ── Handle messages from WebView ──
  const onMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      switch (data.type) {
        case 'external-link':
          Linking.openURL(data.url);
          break;
        case 'title':
          // Could update header title here
          break;
        default:
          break;
      }
    } catch (e) {
      // Non-JSON message, ignore
    }
  };

  // ── Error Screen ──
  if (hasError) {
    return (
      <SafeAreaView style={styles.errorContainer} onLayout={onLayoutRootView}>
        <StatusBar style="light" />
        <View style={styles.errorContent}>
          <Text style={styles.errorIcon}>&#x1F6F0;&#xFE0F;</Text>
          <Text style={styles.errorTitle}>Connection Lost</Text>
          <Text style={styles.errorText}>
            {errorMessage || "Can't reach the Pyonair servers right now."}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setHasError(false);
              setIsLoading(true);
              if (webViewRef.current) {
                webViewRef.current.reload();
              }
            }}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
          <Text style={styles.errorHint}>
            Check your internet connection and try again
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main App ──
  return (
    <SafeAreaView style={styles.container} onLayout={onLayoutRootView}>
      <StatusBar style="light" backgroundColor={BRAND.navy} />

      <WebView
        ref={webViewRef}
        source={{ uri: PORTAL_BASE_URL }}
        style={styles.webview}
        injectedJavaScript={injectedJS}
        onMessage={onMessage}

        // Navigation state
        onNavigationStateChange={(navState) => {
          setCanGoBack(navState.canGoBack);
          setCurrentUrl(navState.url);
        }}

        // Loading
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}

        // Error handling
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn('[WebView] Error:', nativeEvent);
          setHasError(true);
          setErrorMessage(nativeEvent.description || 'Failed to load');
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          if (nativeEvent.statusCode >= 500) {
            setHasError(true);
            setErrorMessage(`Server error (${nativeEvent.statusCode})`);
          }
        }}

        // WebView configuration
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        allowsBackForwardNavigationGestures={true}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        cacheEnabled={true}
        pullToRefreshEnabled={true}
        allowFileAccess={true}

        // iOS specific
        allowsLinkPreview={false}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="automatic"
        decelerationRate="normal"

        // Android specific
        overScrollMode="never"
        textZoom={100}

        // User agent (so portal can detect native app)
        applicationNameForUserAgent="PyonairApp/1.0"

        // Custom loading indicator
        renderLoading={() => (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingContent}>
              <Text style={styles.loadingLogo}>P</Text>
              <Text style={styles.loadingName}>Pyonair</Text>
              <ActivityIndicator size="small" color={BRAND.red} style={{ marginTop: 16 }} />
            </View>
          </View>
        )}
      />

      {/* Loading bar at top */}
      {isLoading && (
        <View style={styles.loadingBar}>
          <View style={styles.loadingBarFill} />
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.navy,
  },
  webview: {
    flex: 1,
    backgroundColor: BRAND.navy,
  },

  // Loading overlay (shown while WebView loads)
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BRAND.navy,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingLogo: {
    fontSize: 48,
    fontWeight: '900',
    color: BRAND.red,
    letterSpacing: -2,
  },
  loadingName: {
    fontSize: 20,
    fontWeight: '700',
    color: BRAND.white,
    marginTop: 8,
    letterSpacing: -0.5,
  },

  // Loading bar
  loadingBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(230, 57, 70, 0.2)',
    zIndex: 20,
  },
  loadingBarFill: {
    width: '60%',
    height: '100%',
    backgroundColor: BRAND.red,
  },

  // Error screen
  errorContainer: {
    flex: 1,
    backgroundColor: BRAND.navy,
  },
  errorContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: BRAND.white,
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  errorText: {
    fontSize: 15,
    color: BRAND.gray400,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  retryButton: {
    backgroundColor: BRAND.red,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 100,
  },
  retryText: {
    color: BRAND.white,
    fontSize: 16,
    fontWeight: '700',
  },
  errorHint: {
    fontSize: 13,
    color: BRAND.gray500,
    marginTop: 20,
  },
});
