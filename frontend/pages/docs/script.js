// script.js

document.addEventListener("DOMContentLoaded", () => {
  // === Highlight active link ===
  const links = document.querySelectorAll(".sidebar nav ul li a");
  const current = window.location.pathname.split("/").pop();

  links.forEach(link => {
    if (link.getAttribute("href") === current) {
      link.classList.add("active");
    }
  });

  // === Smooth scroll for internal anchors ===
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute("href"));
      if (target) {
        target.scrollIntoView({
          behavior: "smooth"
        });
      }
    });
  });

  // === Copy Button Functionality ===
  const copyButton = document.querySelector('.copy-button');
  if (copyButton) {
    copyButton.addEventListener('click', () => {
      const content = document.querySelector('.content').innerText;
      navigator.clipboard.writeText(content).then(() => {
        // Visual feedback
        const originalText = copyButton.innerHTML;
        copyButton.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20,6 9,17 4,12"></polyline>
          </svg>
          Copied!
        `;
        copyButton.style.color = '#10b981';
        
        setTimeout(() => {
          copyButton.innerHTML = originalText;
          copyButton.style.color = '#aaa';
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy: ', err);
      });
    });
  }

  // === Emoji Feedback System ===
  const emojiButtons = document.querySelectorAll('.emoji-btn');
  const thankYouMessage = document.querySelector('.thank-you-message');
  const commentSection = document.querySelector('.comment-section');
  
  emojiButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all buttons
      emojiButtons.forEach(btn => btn.classList.remove('active'));
      
      // Add active class to clicked button
      button.classList.add('active');
      
      // Get the emoji data
      const emoji = button.getAttribute('data-emoji');
      
      // Show "Thank you!" message
      thankYouMessage.style.display = 'block';
      
      // Show comment section after a short delay
      setTimeout(() => {
        commentSection.style.display = 'block';
      }, 500);
      
      // Log feedback
      console.log(`User feedback: ${emoji}`);
      
      // Optional: Send feedback to server
      // sendFeedback(emoji);
    });
  });

  // === Submit Feedback ===
  const submitButton = document.querySelector('.submit-feedback');
  const textarea = document.querySelector('.comment-section textarea');
  
  if (submitButton) {
    submitButton.addEventListener('click', () => {
      const comment = textarea.value.trim();
      const selectedEmoji = document.querySelector('.emoji-btn.active').getAttribute('data-emoji');
      
      if (comment) {
        console.log(`Feedback submitted: ${selectedEmoji} - ${comment}`);
        
        // Show success message
        submitButton.textContent = 'Submitted!';
        submitButton.style.background = '#10b981';
        
        // Disable form
        textarea.disabled = true;
        submitButton.disabled = true;
        
        // Optional: Send to server
        // sendFeedbackWithComment(selectedEmoji, comment);
      } else {
        // Just submit emoji feedback
        console.log(`Emoji feedback submitted: ${selectedEmoji}`);
        submitButton.textContent = 'Submitted!';
        submitButton.style.background = '#10b981';
        submitButton.disabled = true;
      }
    });
  }

  // === Search Functionality ===
  const searchInput = document.querySelector('.search-box input');
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        searchInput.focus();
      }
    });
    
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      // Implement search functionality here
      console.log('Searching for:', query);
    });
  }

  // === Keyboard Shortcuts ===
  document.addEventListener('keydown', (e) => {
    // Ctrl + K for search
    if (e.ctrlKey && e.key === 'k') {
      e.preventDefault();
      searchInput?.focus();
    }
  });

  // === Scroll to Top Functionality ===
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // Add scroll to top button if needed
  const addScrollToTopButton = () => {
    const button = document.createElement('button');
    button.innerHTML = '↑';
    button.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #3b82f6;
      color: white;
      border: none;
      cursor: pointer;
      font-size: 18px;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    
    button.addEventListener('click', scrollToTop);
    document.body.appendChild(button);
    
    // Show/hide based on scroll position
    window.addEventListener('scroll', () => {
      if (window.scrollY > 300) {
        button.style.opacity = '1';
      } else {
        button.style.opacity = '0';
      }
    });
  };

  // Initialize scroll to top button
  addScrollToTopButton();
});

// === Optional: Send feedback to server ===
function sendFeedback(emoji) {
  // This is a placeholder - implement your feedback system
  fetch('/api/feedback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      emoji: emoji,
      page: window.location.pathname,
      timestamp: new Date().toISOString()
    })
  }).catch(err => {
    console.error('Failed to send feedback:', err);
  });
}