// Web3Forms Implementation für Uninstall Feedback
// Ersetze YOUR_ACCESS_KEY mit deinem echten Web3Forms Access Key

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('feedbackForm');
    const thankYouSection = document.getElementById('thankYou');
    const submitBtn = form.querySelector('.submit-btn');

    // Web3Forms Access Key
    const WEB3FORMS_ACCESS_KEY = '533613f5-b3b1-4ca4-9240-dda0a4087686';

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Disable submit button
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';

        // Collect form data
        const formData = new FormData(form);
        const reasons = formData.getAll('reason');
        const feedback = formData.get('feedback');
        const email = formData.get('email');

        // Prepare data for Web3Forms
        const web3FormsData = {
            access_key: WEB3FORMS_ACCESS_KEY,
            subject: 'Monkey Block - Uninstall Feedback',
            from_name: 'Monkey Block User',
            
            // Main feedback data
            reasons: reasons.join(', '),
            detailed_feedback: feedback || 'No detailed feedback provided',
            user_email: email || 'Not provided',
            
            // Metadata
            uninstall_date: new Date().toISOString(),
            extension_version: new URLSearchParams(window.location.search).get('v') || 'unknown',
            
            // Custom message format
            message: `
Uninstall Feedback Received:

REASONS FOR UNINSTALL:
${reasons.map(r => `- ${r}`).join('\n')}

DETAILED FEEDBACK:
${feedback || 'None provided'}

USER EMAIL: ${email || 'Not provided'}
EXTENSION VERSION: ${new URLSearchParams(window.location.search).get('v') || 'unknown'}
DATE: ${new Date().toLocaleString()}
            `.trim()
        };

        try {
            const response = await fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(web3FormsData)
            });

            const result = await response.json();

            if (result.success) {
                // Show thank you message
                form.style.display = 'none';
                thankYouSection.style.display = 'block';

                // Close tab after 5 seconds
                setTimeout(() => {
                    if (window.close) {
                        window.close();
                    }
                }, 5000);
            } else {
                throw new Error(result.message || 'Failed to send feedback');
            }
        } catch (error) {
            console.error('Error sending feedback:', error);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send Feedback';
            alert('Sorry, there was an error sending your feedback. Please try again.');
        }
    });
});