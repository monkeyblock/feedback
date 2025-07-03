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
        });
    });
}

// Setup input field with button transformation
function setupInputButton(inputField, button, type) {
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
            
            // Send quick feedback after a bit of typing
            if (this.value.length > 3) {
                const eventType = type === 'feature' ? 'missing_feature_typed' : 
                                 type === 'issue' ? 'technical_issue_typed' : 
                                 'other_reason_typed';
                sendQuickFeedback(eventType, { [type]: this.value });
            }
        } else {
            // Transform back to Skip if empty
            button.textContent = 'Skip';
            button.className = 'input-btn skip-btn';
            button.onclick = skipToStep2;
        }
    });
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
    
    // Update UI
    document.getElementById('step1').style.display = 'none';
    document.getElementById('step2').style.display = 'block';
    document.getElementById('headerTitle').textContent = 'One more thing... 💭';
    
    // Focus on textarea
    document.getElementById('feedback').focus();
}

// Skip directly to step 2
function skipToStep2() {
    goToStep2();
}

// Show thank you
function showThankYou() {
    document.getElementById('step1').style.display = 'none';
    document.getElementById('step2').style.display = 'none';
    document.getElementById('thankYou').style.display = 'block';
    
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

// Remove progress bar function
// function updateProgress(percent) - removed

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