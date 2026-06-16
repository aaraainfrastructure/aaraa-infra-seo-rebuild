/* ==========================================================================
   AARAA Infrastructure - Interactive Map Presence Script
   ========================================================================== */

document.addEventListener("DOMContentLoaded", function () {
    const markers = document.querySelectorAll(".map-marker");
    const popupCard = document.querySelector(".marker-popup-card");
    const popupAnchor = document.querySelector(".popup-anchor");
    const closeBtn = document.querySelector(".popup-close");
    
    // Popup fields
    const popupCity = document.querySelector(".popup-city");
    const popupState = document.querySelector(".popup-state");
    const popupPresence = document.querySelector(".popup-presence");

    // Close popup
    function closePopup() {
        popupCard.classList.remove("active");
        markers.forEach(m => m.classList.remove("active"));
    }

    // Bind marker clicks
    markers.forEach(marker => {
        marker.addEventListener("click", function (e) {
            e.stopPropagation();
            
            const city = this.getAttribute("data-city");
            const state = this.getAttribute("data-state");
            const presence = this.getAttribute("data-presence");
            const posX = this.getAttribute("data-x");
            const posY = this.getAttribute("data-y");

            // Deactivate other markers
            markers.forEach(m => m.classList.remove("active"));
            this.classList.add("active");

            // Populate popup content
            popupCity.textContent = city;
            popupState.textContent = state;
            popupPresence.textContent = presence;

            // Position popup (Desktop layout absolute anchor positioning)
            if (window.innerWidth >= 768) {
                popupAnchor.style.left = posX + "%";
                popupAnchor.style.top = posY + "%";
            } else {
                // Reset styling for mobile block layout
                popupAnchor.style.left = "";
                popupAnchor.style.top = "";
            }

            // Show popup
            popupCard.classList.add("active");
        });
    });

    // Close handlers
    if (closeBtn) {
        closeBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            closePopup();
        });
    }

    // Close when clicking outside of markers/popup
    document.addEventListener("click", function (e) {
        if (!popupCard.contains(e.target)) {
            closePopup();
        }
    });

    // Handle window resize positioning
    window.addEventListener("resize", function () {
        const activeMarker = document.querySelector(".map-marker.active");
        if (activeMarker && window.innerWidth >= 768) {
            const posX = activeMarker.getAttribute("data-x");
            const posY = activeMarker.getAttribute("data-y");
            popupAnchor.style.left = posX + "%";
            popupAnchor.style.top = posY + "%";
        } else {
            popupAnchor.style.left = "";
            popupAnchor.style.top = "";
        }
    });

    // GSAP ScrollTrigger Entrance Animation
    if (window.gsap && window.ScrollTrigger) {
        // Register ScrollTrigger if needed (usually done in libraries, but safe to do)
        gsap.registerPlugin(ScrollTrigger);

        // Animate section header & column details
        gsap.from(".presence-content > *", {
            scrollTrigger: {
                trigger: ".presence-section",
                start: "top 75%",
                toggleActions: "play none none none"
            },
            y: 40,
            opacity: 0,
            duration: 0.8,
            stagger: 0.15,
            ease: "power3.out"
        });

        // Animate map container
        gsap.from(".map-container-outer", {
            scrollTrigger: {
                trigger: ".presence-section",
                start: "top 70%",
                toggleActions: "play none none none"
            },
            scale: 0.95,
            opacity: 0,
            duration: 1,
            ease: "power2.out"
        });

        // Animate location markers with a stagger pop-in
        gsap.from(".map-marker", {
            scrollTrigger: {
                trigger: ".presence-section",
                start: "top 60%",
                toggleActions: "play none none none"
            },
            scale: 0,
            opacity: 0,
            duration: 0.5,
            stagger: 0.08,
            ease: "back.out(2)"
        });
    }
});
