// js/animations.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. Configure the Observer
    const observerOptions = {
        root: null, // viewport
        rootMargin: '0px',
        threshold: 0.1 // Trigger when 10% of element is visible
    };

    // 2. Create the Observer
    const scrollObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Add class to trigger CSS animation
                entry.target.classList.add('active-reveal');
                
                // Special handling for Channel Lists (Stagger Effect)
                if (entry.target.classList.contains('channel-list')) {
                    const children = entry.target.querySelectorAll('.channel-list-item');
                    children.forEach((child, index) => {
                        // Stagger delays: 0ms, 50ms, 100ms...
                        setTimeout(() => {
                            child.classList.add('visible');
                        }, index * 50); 
                    });
                }
                
                // Stop observing once animated
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // 3. Target Elements
    // Add 'reveal-on-scroll' class to these elements in HTML automatically if not present,
    // or simply select existing ones.
    const targets = document.querySelectorAll('.reveal-on-scroll, .section-header, footer');
    
    targets.forEach(el => {
        el.classList.add('reveal-on-scroll'); // Ensure class exists
        scrollObserver.observe(el);
    });
    
    // Specifically observe the list container
    const channelList = document.querySelector('.channel-list');
    if(channelList) {
        channelList.classList.add('reveal-on-scroll');
        scrollObserver.observe(channelList);
    }
});
