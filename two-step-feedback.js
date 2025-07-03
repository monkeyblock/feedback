// Two-Step Feedback Implementation with Web3Forms
const WEB3FORMS_ACCESS_KEY = '533613f5-b3b1-4ca4-9240-dda0a4087686';

let selectedReason = null;
let feedbackData = {
    stage: 'started',
    reasons: [],
    version: new URLSearchParams(window.location.search).get('v') || 'unknown'
};

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    setupReasonCards();
    setupFormHandlers();
    updateProgress(33);
    
    // Track that user at least opened the form
    sendTelemetry('form_opened');
    
    // Set up auto-send for abandoned forms
    setupAutoSendDraft();
    
    // Restore any existing draft
    restoreDraft();
});

// Step 1: Reason Selection
function setupReasonCards() {
    const cards = document.querySelectorAll('.reason-card');
    const continueBtn = document.getElementById('continueBtn');
    const missingFeatureInput = document.getElementById('missingFeatureInput');
    const quickFeatureField = document.getElementById('quickFeature');
    
    cards.forEach(card => {
        card.addEventListener('click', function() {
            // Remove previous selection
            cards.forEach(c => c.classList.remove('selected'));
            
            // Add selection
            this.classList.add('selected');
            selectedReason = this.dataset.reason;
            continueBtn.disabled = false;
            
            // Show/hide missing feature input
            if (selectedReason === 'missing-feature') {
                missingFeatureInput.style.display = 'block';
                quickFeatureField.focus();
                
                // Auto-save feature request as user types
                quickFeatureField.addEventListener('input', debounce(function() {
                    feedbackData.missingFeature = this.value;
                    saveDraft();
                    
                    // Send immediately if they typed something substantial
                    if (this.value.length > 5) {
                        sendQuickFeedback('missing_feature_typed', {
                            feature: this.value
                        });
                    }
                }, 1000));
            } else {
                missingFeatureInput.style.display = 'none';
            }
            
            // Animate monkey
            document.getElementById('monkeyIcon').classList.add('happy');
            
            // Store reason immediately (in case user leaves)
            feedbackData.reasons = [selectedReason];
            saveDraft();
            sendTelemetry('reason_selected', { reason: selectedReason });
        });
    });
}

// Go to Step 2
function goToStep2() {
    if (!selectedReason) return;
    
    // Send Step 1 data immediately
    sendQuickFeedback('step1_complete');
    
    // Update UI
    document.getElementById('step1').style.display = 'none';
    document.getElementById('step2').style.display = 'block';
    document.getElementById('headerTitle').textContent = 'Almost done! 🎯';
    document.getElementById('headerSubtitle').textContent = 'Your details help us improve (optional)';
    updateProgress(66);
    
    // Focus on textarea
    document.getElementById('feedback').focus();
}

// Skip functions
function skipFeedback() {
    sendTelemetry('skipped_at_step1');
    showThankYou();
}

function skipDetails() {
    sendQuickFeedback('step2_skipped');
    showThankYou();
}

// Step 2: Form submission
function setupFormHandlers() {
    const form = document.getElementById('detailsForm');
    
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
            showThankYou();
        } catch (error) {
            console.error('Error:', error);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send Feedback';
            alert('Sorry, there was an error. Please try again.');
        }
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
    
    const data = {
        access_key: WEB3FORMS_ACCESS_KEY,
        subject: 'Monkey Block - Complete Uninstall Feedback',
        from_name: 'Monkey Block User',
        
        // Main data
        reason: selectedReason,
        missing_feature: missingFeature || '',
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

DETAILED FEEDBACK:
${feedbackData.feedback || 'No additional details provided'}

USER EMAIL: ${feedbackData.email || 'Not provided'}

METADATA:
- Extension Version: ${feedbackData.version}
- Submitted: ${new Date().toLocaleString()}
- Form Type: Two-Step Process
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

// Show thank you
function showThankYou() {
    document.getElementById('step1').style.display = 'none';
    document.getElementById('step2').style.display = 'none';
    document.getElementById('thankYou').style.display = 'block';
    updateProgress(100);
    
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

// Update progress bar
function updateProgress(percent) {
    document.getElementById('progressBar').style.width = percent + '%';
}

// Auto-save draft (optional enhancement)
let draftTimer;
function setupAutoSave() {
    const textarea = document.getElementById('feedback');
    const email = document.getElementById('email');
    
    [textarea, email].forEach(field => {
        field.addEventListener('input', () => {
            clearTimeout(draftTimer);
            draftTimer = setTimeout(() => {
                localStorage.setItem('feedback-draft', JSON.stringify({
                    feedback: textarea.value,
                    email: email.value,
                    reason: selectedReason,
                    timestamp: Date.now()
                }));
            }, 1000);
        });
    });
}

// Restore draft on load
function restoreDraft() {
    const draft = localStorage.getItem('feedback-draft');
    if (draft) {
        const data = JSON.parse(draft);
        // Only restore if less than 1 hour old
        if (Date.now() - data.timestamp < 3600000) {
            document.getElementById('feedback').value = data.feedback || '';
            document.getElementById('email').value = data.email || '';
        }
    }
}// Auto-save draft functionality
function saveDraft() {
    const draftData = {
        reason: selectedReason,
        missingFeature: feedbackData.missingFeature || '',
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

// Debounce helper
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Enhanced quick feedback for missing features
async function sendQuickFeedback(stage, extraData = {}) {
    const data = {
        access_key: WEB3FORMS_ACCESS_KEY,
        subject: `Monkey Block - Quick Feedback (${stage})`,
        from_name: 'Monkey Block User',
        reason: selectedReason,
        stage: stage,
        version: feedbackData.version,
        timestamp: new Date().toISOString(),
        ...extraData
    };
    
    // Special handling for missing feature
    if (selectedReason === 'missing-feature' && feedbackData.missingFeature) {
        data.missing_feature = feedbackData.missingFeature;
        data.message = `User needs feature: ${feedbackData.missingFeature}`;
    }
    
    // Fire and forget - don't wait for response
    fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }).catch(() => {}); // Silently fail
}