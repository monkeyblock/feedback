/*
 * Monkey Block - Amplitude Analytics for Feedback Page
 * Copyright (c) 2025
 * All rights reserved.
 */

// Amplitude Analytics class for feedback page
class AmplitudeFeedback {
  constructor() {
    this.apiKey = 'ad0a670d36f60cd419802ccfb5252139';
    this.apiEndpoint = 'https://api.eu.amplitude.com/2/httpapi';
    this.userId = null;
    this.deviceId = null;
    this.sessionId = Date.now();
    this.installDate = null;
    this.daysUsed = null;
  }

  async init() {
    try {
      // Get all URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      
      // Get install date from URL parameter
      const installDateParam = urlParams.get('install_date');
      if (installDateParam) {
        this.installDate = new Date(installDateParam);
        const now = new Date();
        this.daysUsed = Math.floor((now - this.installDate) / (1000 * 60 * 60 * 24));
      }

      // PRIORITY 1: Try to get user ID and device ID from URL parameters
      const urlUserId = urlParams.get('uid');
      const urlDeviceId = urlParams.get('did');
      
      if (urlUserId) {
        this.userId = urlUserId;
        console.log('[Amplitude Feedback] Got user ID from URL:', this.userId);
      }
      
      if (urlDeviceId) {
        this.deviceId = urlDeviceId;
        console.log('[Amplitude Feedback] Got device ID from URL:', this.deviceId);
      }

      // PRIORITY 2: If no URL params, try to get from extension via runtime API
      if (!this.userId || !this.deviceId) {
        await this.getUserIdFromExtension();
      }
      
      // PRIORITY 3: If still no user ID, generate a temporary one with fingerprint
      if (!this.userId) {
        const fingerprint = await this.generateSimpleFingerprint();
        this.userId = `uninstall_user_${fingerprint}_${Date.now()}`;
        console.log('[Amplitude Feedback] Generated fallback user ID:', this.userId);
      }

      // Generate device ID if not available
      if (!this.deviceId) {
        this.deviceId = `uninstall_device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log('[Amplitude Feedback] Generated fallback device ID:', this.deviceId);
      }

      console.log('[Amplitude Feedback] Initialized:', {
        userId: this.userId,
        deviceId: this.deviceId,
        installDate: this.installDate,
        daysUsed: this.daysUsed,
        fromUrl: !!urlUserId
      });

    } catch (error) {
      console.error('[Amplitude Feedback] Init error:', error);
      // Emergency fallback IDs
      this.userId = `fallback_user_${Date.now()}`;
      this.deviceId = `fallback_device_${Date.now()}`;
    }
  }

  async getUserIdFromExtension() {
    try {
      // Try to communicate with extension if it's still installed
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        // Get extension ID from URL parameter or use hardcoded ID
        const urlParams = new URLSearchParams(window.location.search);
        const extensionId = urlParams.get('ext_id') || 'YOUR_EXTENSION_ID_HERE'; // Will be replaced with actual ID
        
        // Try to get data from extension
        return new Promise((resolve) => {
          chrome.runtime.sendMessage(extensionId, 
            { action: 'getAmplitudeData' }, 
            (response) => {
              if (chrome.runtime.lastError) {
                console.log('[Amplitude Feedback] Extension not responding:', chrome.runtime.lastError);
                resolve(null);
                return;
              }
              
              if (response && response.userId) {
                this.userId = response.userId;
                this.deviceId = response.deviceId || this.deviceId;
                console.log('[Amplitude Feedback] Got user data from extension:', response);
              }
              resolve(response);
            }
          );
          
          // Timeout after 1 second
          setTimeout(() => resolve(null), 1000);
        });
      }
    } catch (error) {
      console.log('[Amplitude Feedback] Could not get data from extension:', error);
    }
    return null;
  }

  async generateSimpleFingerprint() {
    try {
      const components = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        hardwareConcurrency: navigator.hardwareConcurrency || 0,
        screenResolution: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };
      
      const fingerprint = Object.values(components).join('|');
      
      // Simple hash function
      let hash = 0;
      for (let i = 0; i < fingerprint.length; i++) {
        const char = fingerprint.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      
      return Math.abs(hash).toString(36);
    } catch (error) {
      console.error('[Amplitude Feedback] Fingerprint error:', error);
      return Math.random().toString(36).substr(2, 9);
    }
  }

  async track(eventType, eventProperties = {}) {
    try {
      // Add standard properties to all events
      const enhancedProperties = {
        ...eventProperties,
        feedback_page: true,
        install_date: this.installDate ? this.installDate.toISOString() : null,
        days_used: this.daysUsed,
        uninstall_date: new Date().toISOString(),
        extension_version: new URLSearchParams(window.location.search).get('v') || 'unknown'
      };

      const event = {
        user_id: this.userId,
        device_id: this.deviceId,
        session_id: this.sessionId,
        event_type: eventType,
        event_properties: enhancedProperties,
        time: Date.now()
      };

      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': '*/*'
        },
        body: JSON.stringify({
          api_key: this.apiKey,
          events: [event]
        })
      });

      if (!response.ok) {
        console.error('[Amplitude Feedback] Failed to track event:', response.status);
      } else {
        console.log('[Amplitude Feedback] Event tracked:', eventType, enhancedProperties);
      }

    } catch (error) {
      console.error('[Amplitude Feedback] Error tracking event:', error);
    }
  }

  // Track uninstall with comprehensive data
  async trackUninstall(reason, details = {}) {
    const uninstallProperties = {
      uninstall_reason: reason,
      uninstall_reason_details: details,
      days_until_uninstall: this.daysUsed,
      ...details
    };

    // Main uninstall event
    await this.track('Extension Uninstalled', uninstallProperties);

    // Also set user properties to mark as churned
    await this.setUserProperties({
      churned: true,
      churn_date: new Date().toISOString(),
      churn_reason: reason,
      lifetime_days: this.daysUsed
    });
  }

  async setUserProperties(properties) {
    try {
      const identifyPayload = {
        user_id: this.userId,
        device_id: this.deviceId,
        user_properties: properties
      };

      const params = new URLSearchParams();
      params.append('api_key', this.apiKey);
      params.append('identification', JSON.stringify([identifyPayload]));

      const identifyEndpoint = 'https://api.eu.amplitude.com/identify';

      await fetch(identifyEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': '*/*'
        },
        body: params.toString()
      });

      console.log('[Amplitude Feedback] User properties set:', properties);
    } catch (error) {
      console.error('[Amplitude Feedback] Error setting user properties:', error);
    }
  }
}

// Export for use in feedback page
window.AmplitudeFeedback = AmplitudeFeedback;
