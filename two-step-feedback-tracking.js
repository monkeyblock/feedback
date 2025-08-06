// two-step-feedback-tracking.js
// Amplitude tracking for uninstall feedback page

(function() {
  // Parse URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const version = urlParams.get('version') || 'unknown';
  const userId = urlParams.get('uid') || 'unknown';
  const installTimestamp = urlParams.get('installed');
  
  // Calculate days since install
  let daysSinceInstall = 0;
  if (installTimestamp) {
    daysSinceInstall = Math.floor((Date.now() - parseInt(installTimestamp)) / (1000 * 60 * 60 * 24));
  }
  
  // Simple Amplitude tracking (without full SDK)
  const AMPLITUDE_API_KEY = 'ad0a670d36f60cd419802ccfb5252139';
  const AMPLITUDE_API_ENDPOINT = 'https://api.eu.amplitude.com/2/httpapi';
  
  async function trackEvent(eventType, eventProperties = {}) {
    try {
      const event = {
        user_id: userId,
        device_id: userId + '_uninstall',
        event_type: eventType,
        event_properties: {
          ...eventProperties,
          version: version,
          days_since_install: daysSinceInstall,
          timestamp: new Date().toISOString()
        },
        time: Date.now()
      };
      
      await fetch(AMPLITUDE_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          api_key: AMPLITUDE_API_KEY,
          events: [event]
        })
      });
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  }
  
  // Track page view
  trackEvent('Uninstall Feedback Page Viewed', {
    source: 'chrome_uninstall'
  });
  
  // Track quick feedback selection
  document.querySelectorAll('.reason-card').forEach(card => {
    card.addEventListener('click', function() {
      const reason = this.querySelector('input').value;
      const reasonText = this.querySelector('.reason-title').textContent;
      
      trackEvent('Uninstall Reason Selected', {
        reason: reason,
        reason_text: reasonText,
        step: 'quick_feedback'
      });
    });
  });
  
  // Track detailed feedback submission
  const submitBtn = document.querySelector('.submit-btn');
  if (submitBtn) {
    submitBtn.addEventListener('click', async function() {
      const selectedReasons = Array.from(document.querySelectorAll('input[name="reason"]:checked'))
        .map(input => input.value);
      
      const hasDetailedFeedback = document.querySelector('textarea').value.trim().length > 0;
      const hasEmail = document.querySelector('input[type="email"]').value.trim().length > 0;
      
      await trackEvent('Uninstall Feedback Submitted', {
        reasons: selectedReasons,
        reasons_count: selectedReasons.length,
        has_detailed_feedback: hasDetailedFeedback,
        has_email: hasEmail,
        step: 'detailed_feedback'
      });
      
      // Track if user is open to reinstall (based on email provision)
      if (hasEmail) {
        await trackEvent('User Open to Reinstall', {
          provided_email: true
        });
      }
    });
  }
  
  // Track skip actions
  const skipBtn = document.querySelector('.skip-btn');
  if (skipBtn) {
    skipBtn.addEventListener('click', function() {
      trackEvent('Uninstall Feedback Skipped', {
        step: 'detailed_feedback'
      });
    });
  }
  
  // Track page abandonment
  let pageInteracted = false;
  document.addEventListener('click', function() {
    pageInteracted = true;
  });
  
  window.addEventListener('beforeunload', function() {
    if (!pageInteracted) {
      trackEvent('Uninstall Feedback Abandoned', {
        time_on_page: Math.floor((Date.now() - performance.timing.navigationStart) / 1000)
      });
    }
  });
  
  // Display days since install on page (optional)
  if (daysSinceInstall > 0) {
    console.log(`User used Monkey Block for ${daysSinceInstall} days before uninstalling`);
  }
})();
