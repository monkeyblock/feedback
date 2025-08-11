/*
 * Monkey Block - Chrome Extension
 * Copyright (c) 2025
 * All rights reserved.
 * 
 * This code is proprietary and confidential.
 * Unauthorized copying or distribution is prohibited.
 */

// Two-Step Feedback Implementation with Web3Forms and Amplitude Analytics
const WEB3FORMS_ACCESS_KEY = '533613f5-b3b1-4ca4-9240-dda0a4087686';

// Initialize Amplitude Analytics
let amplitudeTracker = null;

async function initAmplitude() {
    amplitudeTracker = new window.AmplitudeFeedback();
    await amplitudeTracker.init();
    
    // Track that the feedback page was opened
    await amplitudeTracker.track('Uninstall - Feedback Opened', {
        source: 'uninstall',
        page_type: 'two_step_feedback'
    });
}

let selectedReason = null;
let feedbackData = {
    stage: 'started',
    reasons: [],
    version: new URLSearchParams(window.location.search).get('v') || 'unknown'
};

// Initialize
document.addEventListener('DOMContentLoaded', async function() {
    // Initialize Amplitude first
    await initAmplitude();
    
    setupReasonCards();
    setupFormHandlers();
    
    // Track that user at least opened the form
    sendTelemetry('form_opened');
    
    // Set up auto-send for abandoned forms
    setupAutoSendDraft();
    
    // Restore any existing draft
    restoreDraft();
    
    // Setup abandonment tracking for Step 2
    setupAbandonmentTracking();
});

// Step 1: Reason Selection
function setupReasonCards() {
    const cards = document.querySelectorAll('.reason-card');
    const missingFeatureInput = document.getElementById('missingFeatureInput');
    const somethingElseInput = document.getElementById('somethingElseInput');
    const technicalIssueInput = document.getElementById('technicalIssueInput');
    const quickFeatureField = document.getElementById('quickFeature');
    const quickOtherField = document.getElementById('quickOther');
    const quickIssueField = document.getElementById('quickIssue');
    
    // Button references
    const featureBtn = document.getElementById('featureSkipBtn');
    const issueBtn = document.getElementById('issueSkipBtn');
    const otherBtn = document.getElementById('otherSkipBtn');
    
    // Setup input listeners for button transformation
    setupInputButton(quickFeatureField, featureBtn, 'feature');
    setupInputButton(quickIssueField, issueBtn, 'issue');
    setupInputButton(quickOtherField, otherBtn, 'other');
    
    cards.forEach(card => {
        card.addEventListener('click', function() {
            // Remove previous selection
            cards.forEach(c => c.classList.remove('selected'));
            
            // Add selection
            this.classList.add('selected');
            selectedReason = this.dataset.reason;
            
            // Hide all inputs first
            missingFeatureInput.style.display = 'none';
            somethingElseInput.style.display = 'none';
            technicalIssueInput.style.display = 'none';
            
            // Reset all buttons to Skip
            [featureBtn, issueBtn, otherBtn].forEach(btn => {
                btn.textContent = 'Skip';
                btn.className = 'input-btn skip-btn';
                btn.onclick = skipToStep2;
            });
            
            // Show/hide specific inputs
            if (selectedReason === 'missing-feature') {
                missingFeatureInput.style.display = 'flex';
                quickFeatureField.focus();
                quickFeatureField.value = feedbackData.missingFeature || '';
                if (quickFeatureField.value) {
                    transformToSendButton(featureBtn);
                }
            } else if (selectedReason === 'something-else') {
                somethingElseInput.style.display = 'flex';
                quickOtherField.focus();
                quickOtherField.value = feedbackData.otherReason || '';
                if (quickOtherField.value) {
                    transformToSendButton(otherBtn);
                }
            } else if (selectedReason === 'bugs') {
                technicalIssueInput.style.display = 'flex';
                quickIssueField.focus();
                quickIssueField.value = feedbackData.technicalIssue || '';
                if (quickIssueField.value) {
                    transformToSendButton(issueBtn);
                }
            } else {
                // For other reasons, go directly to step 2
                setTimeout(() => goToStep2(), 300);
            }
            
            // Animate monkey
            document.getElementById('monkeyIcon').classList.remove('sad');
            document.getElementById('monkeyIcon').classList.add('happy');
            
            // Store reason immediately (in case user leaves)
            feedbackData.reasons = [selectedReason];
            saveDraft();
            sendTelemetry('reason_selected', { reason: selectedReason });
            
            // Track in Amplitude with specific reason events
            if (amplitudeTracker) {
                // Map reason to proper event name
                const reasonEventMap = {
                    'missing-feature': 'Uninstall - Reason - Missing Feature',
                    'confusing': 'Uninstall - Reason - Complicated',
                    'bugs': 'Uninstall - Reason - Tech Issue',
                    'better-alternative': 'Uninstall - Reason - Better App',
                    'something-else': 'Uninstall - Reason - Something Else'
                };
                
                const eventName = reasonEventMap[selectedReason] || 'Uninstall - Reason - Unknown';
                amplitudeTracker.track(eventName, {
                    reason: selectedReason,
                    step: 1
                });
            }
        });
    });
}

// Setup input field with button transformation
function setupInputButton(inputField, button, type) {
    let hasTrackedQuickSubmit = false; // Track only once per input
    
    inputField.addEventListener('input', function() {
        if (this.value.trim().length > 0) {
            transformToSendButton(button);
            
            // Save data
            if (type === 'feature') {
                feedbackData.missingFeature = this.value;
            } else if (type === 'issue') {
                feedbackData.technicalIssue = this.value;
            } else if (type === 'other') {
                feedbackData.otherReason = this.value;
            }
            
            saveDraft();
        } else {
            // Transform back to Skip if empty
            button.textContent = 'Skip';
            button.className = 'input-btn skip-btn';
            button.onclick = skipToStep2;
            hasTrackedQuickSubmit = false; // Reset tracking flag
        }
    });
    
    // Also track when user finishes typing (on blur or enter)
    inputField.addEventListener('blur', function() {
        trackQuickSubmitIfNeeded(this.value, type);
    });
    
    inputField.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && this.value.trim().length > 0) {
            trackQuickSubmitIfNeeded(this.value, type);
            goToStep2();
        }
    });
    
    function trackQuickSubmitIfNeeded(value, inputType) {
        if (value.trim().length > 0 && !hasTrackedQuickSubmit && amplitudeTracker) {
            hasTrackedQuickSubmit = true;
            amplitudeTracker.track('Uninstall - Reason - Quick Submitted', {
                reason: selectedReason,
                input_type: inputType,
                input_text: value,
                input_length: value.length
            });
        }
    }
}

// Transform button to Send
function transformToSendButton(button) {
    button.textContent = 'Send';
    button.className = 'input-btn send-btn';
    button.onclick = function() {
        saveDraft();
        goToStep2();
    };
}

// Go to Step 2
function goToStep2() {
    if (!selectedReason) return;
    
    // Send Step 1 data immediately
    sendQuickFeedback('step1_complete');
    
    // Track in Amplitude
    if (amplitudeTracker) {
        amplitudeTracker.track('Uninstall - Feedback Step 2', {
            reason: selectedReason,
            has_missing_feature: !!feedbackData.missingFeature,
            has_technical_issue: !!feedbackData.technicalIssue,
            has_other_reason: !!feedbackData.otherReason
        });
    }
    
    // Update UI
    document.getElementById('step1').style.display = 'none';
    document.getElementById('step2').style.display = 'block';
    document.getElementById('headerTitle').textContent = 'One more thing... 💭';
    
    // Focus on textarea
    document.getElementById('feedback').focus();
}

// Skip directly to step 2
function skipToStep2() {
    // Track skip action in Amplitude
    if (amplitudeTracker) {
        amplitudeTracker.track('Uninstall - Feedback Input Skipped', {
            reason: selectedReason,
            skipped_field: selectedReason === 'missing-feature' ? 'feature' :
                          selectedReason === 'bugs' ? 'issue' :
                          selectedReason === 'something-else' ? 'other' : 'none'
        });
    }
    goToStep2();
}

// Show thank you
function showThankYou() {
    document.getElementById('step1').style.display = 'none';
    document.getElementById('step2').style.display = 'none';
    document.getElementById('thankYou').style.display = 'block';
    
    // Track completion in Amplitude
    if (amplitudeTracker) {
        amplitudeTracker.track('Uninstall - Feedback Submitted', {
            reason: selectedReason,
            has_detailed_feedback: !!feedbackData.feedback,
            has_email: !!feedbackData.email,
            feedback_length: feedbackData.feedback ? feedbackData.feedback.length : 0,
            detailed_feedback: feedbackData.feedback || null
        });
    }
    
    // Track Reddit Pixel Event for Uninstall
    if (typeof rdt !== 'undefined') {
        rdt('track', 'Custom', {
            customEventName: 'Extension_Uninstalled',
            value: 1,
            currency: 'USD'
        });
        console.log('[Reddit] Tracked Extension_Uninstalled event');
    }
    
    // Confetti effect (optional)
    if (typeof confetti !== 'undefined') {
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });
    }
    
    // Close after 5 seconds
    setTimeout(() => {
        if (window.close) {
            window.close();
        }
    }, 5000);
}

// Step 2: Form submission
function setupFormHandlers() {
    const form = document.getElementById('detailsForm');
    const feedbackTextarea = document.getElementById('feedback');
    
    // Track text input in Step 2
    let step2TextTimer;
    feedbackTextarea.addEventListener('input', function() {
        clearTimeout(step2TextTimer);
        feedbackData.feedback = this.value;
        saveDraft();
        
        // Debounce to avoid too many saves
        step2TextTimer = setTimeout(() => {
            saveDraft();
        }, 1000);
    });
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';
        
        // Collect all data
        feedbackData.feedback = form.feedback.value;
        feedbackData.email = form.email.value;
        feedbackData.stage = 'completed';
        
        try {
            await sendFullFeedback();
            
            // Track uninstall in Amplitude with full details
            if (amplitudeTracker) {
                const uninstallDetails = {
                    missing_feature: feedbackData.missingFeature || null,
                    technical_issue: feedbackData.technicalIssue || null, 
                    other_reason: feedbackData.otherReason || null,
                    detailed_feedback: feedbackData.feedback || null,
                    has_email: !!feedbackData.email
                };
                
                await amplitudeTracker.trackUninstall(selectedReason, uninstallDetails);
            }
            
            showThankYou();
        } catch (error) {
            console.error('Error:', error);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send Feedback';
            alert('Sorry, there was an error. Please try again.');
        }
    });
}

// Setup abandonment tracking for Step 2
function setupAbandonmentTracking() {
    let isStep2Active = false;
    let hasSubmitted = false;
    
    // Track when Step 2 becomes active
    const observer = new MutationObserver((mutations) => {
        const step2 = document.getElementById('step2');
        if (step2 && step2.style.display !== 'none') {
            isStep2Active = true;
        } else {
            isStep2Active = false;
        }
    });
    
    observer.observe(document.body, { 
        childList: true, 
        subtree: true,
        attributes: true,
        attributeFilter: ['style']
    });
    
    // Track abandonment on page unload
    window.addEventListener('beforeunload', () => {
        if (isStep2Active && !hasSubmitted && amplitudeTracker) {
            const feedbackText = document.getElementById('feedback')?.value || '';
            
            if (feedbackText.trim().length > 0) {
                // User wrote something but didn't submit
                amplitudeTracker.track('Uninstall - Abandonment Step 2', {
                    reason: selectedReason,
                    abandoned_text: feedbackText,
                    text_length: feedbackText.length,
                    has_email: !!document.getElementById('email')?.value
                });
            }
        }
    });
    
    // Mark as submitted when form is submitted
    document.getElementById('detailsForm').addEventListener('submit', () => {
        hasSubmitted = true;
    });
}

// Send quick feedback (Step 1 only)
async function sendQuickFeedback(stage) {
    const data = {
        access_key: WEB3FORMS_ACCESS_KEY,
        subject: `Monkey Block - Quick Feedback (${stage})`,
        from_name: 'Monkey Block User',
        reason: selectedReason,
        stage: stage,
        version: feedbackData.version,
        timestamp: new Date().toISOString()
    };
    
    // Fire and forget - don't wait for response
    fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }).catch(() => {}); // Silently fail
}

// Send full feedback
async function sendFullFeedback() {
    const missingFeature = document.getElementById('quickFeature')?.value || feedbackData.missingFeature;
    const otherReason = document.getElementById('quickOther')?.value || feedbackData.otherReason;
    const technicalIssue = document.getElementById('quickIssue')?.value || feedbackData.technicalIssue;
    
    const data = {
        access_key: WEB3FORMS_ACCESS_KEY,
        subject: 'Monkey Block - Complete Uninstall Feedback',
        from_name: 'Monkey Block User',
        
        // Main data
        reason: selectedReason,
        missing_feature: missingFeature || '',
        other_reason: otherReason || '',
        technical_issue: technicalIssue || '',
        detailed_feedback: feedbackData.feedback || 'No details provided',
        user_email: feedbackData.email || 'Not provided',
        
        // Metadata
        version: feedbackData.version,
        timestamp: new Date().toISOString(),
        
        // Formatted message
        message: `
COMPLETE UNINSTALL FEEDBACK:

PRIMARY REASON: ${selectedReason}
${missingFeature ? `MISSING FEATURE: ${missingFeature}` : ''}
${technicalIssue ? `TECHNICAL ISSUE: ${technicalIssue}` : ''}
${otherReason ? `OTHER REASON: ${otherReason}` : ''}

DETAILED FEEDBACK:
${feedbackData.feedback || 'No additional details provided'}

USER EMAIL: ${feedbackData.email || 'Not provided'}

METADATA:
- Extension Version: ${feedbackData.version}
- Submitted: ${new Date().toLocaleString()}
- Form Type: Two-Step Process (Simplified)
        `.trim()
    };
    
    const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    
    if (!response.ok) {
        throw new Error('Failed to send feedback');
    }
    
    // Mark as sent and clear draft
    feedbackData.sent = true;
    localStorage.removeItem('feedback-draft');
}

// Analytics telemetry (optional - for tracking completion rates)
function sendTelemetry(event, data = {}) {
    // You could send this to Google Analytics, Mixpanel, etc.
    console.log('Telemetry:', event, data);
    
    // Example with GA4 (if implemented):
    // gtag('event', event, data);
}

// Auto-save draft functionality
function saveDraft() {
    const draftData = {
        reason: selectedReason,
        missingFeature: feedbackData.missingFeature || '',
        otherReason: feedbackData.otherReason || '',
        technicalIssue: feedbackData.technicalIssue || '',
        feedback: document.getElementById('feedback')?.value || '',
        email: document.getElementById('email')?.value || '',
        timestamp: Date.now(),
        version: feedbackData.version
    };
    
    localStorage.setItem('feedback-draft', JSON.stringify(draftData));
}

// Setup auto-send for abandoned drafts
function setupAutoSendDraft() {
    // Check every 30 seconds if there's an abandoned draft
    setInterval(() => {
        const draft = localStorage.getItem('feedback-draft');
        if (draft) {
            const data = JSON.parse(draft);
            // If draft is 10+ minutes old and not sent, send it
            if (Date.now() - data.timestamp > 10 * 60 * 1000) {
                sendAbandonedDraft(data);
                localStorage.removeItem('feedback-draft');
            }
        }
    }, 30000);
    
    // Also send on page unload if draft exists
    window.addEventListener('beforeunload', () => {
        const draft = localStorage.getItem('feedback-draft');
        if (draft && !feedbackData.sent) {
            const data = JSON.parse(draft);
            // Only send if user spent some time on the form
            if (Date.now() - data.timestamp > 5000) {
                sendAbandonedDraft(data);
            }
        }
    });
}

// Restore draft on load
function restoreDraft() {
    const draft = localStorage.getItem('feedback-draft');
    if (draft) {
        const data = JSON.parse(draft);
        // Only restore if less than 1 hour old
        if (Date.now() - data.timestamp < 3600000) {
            feedbackData = { ...feedbackData, ...data };
            if (document.getElementById('feedback')) {
                document.getElementById('feedback').value = data.feedback || '';
            }
            if (document.getElementById('email')) {
                document.getElementById('email').value = data.email || '';
            }
        }
    }
}

// Send abandoned draft
async function sendAbandonedDraft(draftData) {
    const payload = {
        access_key: WEB3FORMS_ACCESS_KEY,
        subject: 'Monkey Block - Abandoned Feedback Draft',
        from_name: 'Monkey Block User',
        
        // Draft data
        reason: draftData.reason || 'not selected',
        missing_feature: draftData.missingFeature || '',
        partial_feedback: draftData.feedback || '',
        email: draftData.email || 'not provided',
        
        // Metadata
        draft_age_minutes: Math.floor((Date.now() - draftData.timestamp) / 60000),
        version: draftData.version,
        
        message: `
ABANDONED FEEDBACK DRAFT:

REASON: ${draftData.reason || 'Not selected'}
${draftData.missingFeature ? `MISSING FEATURE: ${draftData.missingFeature}` : ''}

PARTIAL FEEDBACK: ${draftData.feedback || 'None'}
EMAIL: ${draftData.email || 'Not provided'}

This draft was abandoned after ${Math.floor((Date.now() - draftData.timestamp) / 60000)} minutes.
Version: ${draftData.version}
        `.trim()
    };
    
    // Fire and forget
    fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).catch(() => {});
}
