/* ==========================================================================
   AARAA Infrastructure - Home Page ScrollTrigger Animation Script
   ========================================================================== */

document.addEventListener("DOMContentLoaded", function () {
    // 1. Check if GSAP and ScrollTrigger are loaded
    if (typeof gsap === "undefined") {
        console.warn("[AARAA Animations] GSAP is not loaded.");
        return;
    }

    // Register ScrollTrigger if it exists
    if (typeof ScrollTrigger !== "undefined") {
        gsap.registerPlugin(ScrollTrigger);
    } else {
        console.warn("[AARAA Animations] GSAP ScrollTrigger is not loaded.");
        return;
    }

    // 2. Custom Text Splitting Helper (Robust fallback for SplitText)
    function splitTextToReveal(element) {
        if (!element) return;
        
        // If SplitText is loaded as a GreenSock plugin, we can use it
        if (window.SplitText) {
            const split = new SplitText(element, { type: "lines,words", linesClass: "reveal-line" });
            split.lines.forEach(line => {
                const wrapper = document.createElement("div");
                wrapper.className = "reveal-wrapper";
                line.parentNode.insertBefore(wrapper, line);
                wrapper.appendChild(line);
            });
            return split;
        }
        
        // Safe, native fallback text splitting by lines/words
        const text = element.innerHTML.trim();
        // Simple wrap for lines (split by br or manual wrapper)
        const lines = text.split("<br>").map(line => line.trim());
        element.innerHTML = "";
        
        lines.forEach(lineText => {
            const wrapper = document.createElement("div");
            wrapper.className = "reveal-wrapper";
            
            const lineSpan = document.createElement("span");
            lineSpan.className = "reveal-line";
            lineSpan.innerHTML = lineText;
            
            wrapper.appendChild(lineSpan);
            element.appendChild(wrapper);
            if (lines.length > 1) {
                element.appendChild(document.createElement("br"));
            }
        });
    }

    /* ==========================================================================
       SECTION 1: Smart Header / Nav Scroll Animation
       ========================================================================== */
    const header = document.querySelector("header");
    if (header) {
        header.classList.add("header-animated");
        let lastScrollY = window.scrollY;

        window.addEventListener("scroll", () => {
            const currentScrollY = window.scrollY;
            
            // Add background-blur and background-color when scrolled down
            if (currentScrollY > 60) {
                header.classList.add("header-scrolled");
            } else {
                header.classList.remove("header-scrolled");
            }

            // Hide header on scroll down, show on scroll up
            if (currentScrollY > lastScrollY && currentScrollY > 150) {
                header.classList.add("header-hidden");
            } else {
                header.classList.remove("header-hidden");
            }
            lastScrollY = currentScrollY;
        });
    }

    /* ==========================================================================
       SECTION 2: Hero Section (Ken Burns Scale Effect)
       ========================================================================== */
    const heroVideo = document.querySelector(".yt-hero__iframe");
    if (heroVideo) {
        gsap.fromTo(heroVideo, 
            { scale: 1.15, opacity: 0 },
            { scale: 1.0, opacity: 1, duration: 1.8, ease: "power2.out" }
        );
    }

    /* ==========================================================================
       SECTION 3: About Us Section (Entrance Animations)
       ========================================================================== */
    const aboutLeftImage = document.querySelector(".section-about-left .image img");
    if (aboutLeftImage) {
        // Slow parallax scroll effect on image
        gsap.fromTo(aboutLeftImage,
            { yPercent: -10, scale: 1.05 },
            { 
                yPercent: 10, 
                scale: 1.0,
                ease: "none",
                scrollTrigger: {
                    trigger: ".section-about",
                    start: "top bottom",
                    end: "bottom top",
                    scrub: true
                }
            }
        );
    }

    // Text Reveal in About Us
    const aboutSubtitle = document.querySelector(".section-about-right .sub-title");
    const aboutTitle1 = document.querySelector(".section-about-right .heading-125");
    const aboutTitle2 = document.querySelector(".section-about-right .heading-125-light");
    const aboutDesc = document.querySelector(".section-about-right p");
    const aboutBtn = document.querySelector(".section-about-right .bottom-btn");

    // Pre-wrap titles
    splitTextToReveal(aboutTitle1);
    splitTextToReveal(aboutTitle2);

    const aboutTimeline = gsap.timeline({
        scrollTrigger: {
            trigger: ".section-about",
            start: "top 70%",
            toggleActions: "play none none none"
        }
    });

    if (aboutSubtitle) aboutTimeline.from(aboutSubtitle, { y: 20, opacity: 0, duration: 0.5, ease: "power2.out" });
    
    const revealLines = document.querySelectorAll(".section-about-right .reveal-line");
    if (revealLines.length > 0) {
        aboutTimeline.to(revealLines, {
            y: "0%",
            opacity: 1,
            duration: 0.8,
            stagger: 0.1,
            ease: "power3.out"
        }, "-=0.3");
    }

    if (aboutDesc) aboutTimeline.from(aboutDesc, { y: 30, opacity: 0, duration: 0.6, ease: "power2.out" }, "-=0.4");
    if (aboutBtn) aboutTimeline.from(aboutBtn, { y: 20, opacity: 0, duration: 0.5, ease: "power2.out" }, "-=0.3");


    /* ==========================================================================
       SECTION 4: Counter / Stats Section (Odometer trigger)
       ========================================================================== */
    const statsSection = document.querySelector(".section-about.p-testimonials");
    if (statsSection) {
        gsap.from(".section-about.p-testimonials .number-counter", {
            scrollTrigger: {
                trigger: statsSection,
                start: "top 75%",
                onEnter: () => {
                    // Trigger countup odometers if the library is present
                    const counters = document.querySelectorAll(".odometer");
                    counters.forEach(counter => {
                        const targetVal = counter.getAttribute("data-value") || counter.innerText;
                        counter.innerHTML = targetVal;
                    });
                }
            }
        });
    }

    /* ==========================================================================
       SECTION 5: "Sectors We Serve" Section
       ========================================================================== */
    const sectorsTitle = document.querySelector(".section-services h2");
    if (sectorsTitle) {
        gsap.from(sectorsTitle, {
            y: 30,
            opacity: 0,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: {
                trigger: ".section-services",
                start: "top 75%"
            }
        });
    }

    const sectorItems = document.querySelectorAll(".section-services [class*='col-']");
    if (sectorItems.length > 0) {
        // Mark these cards with our animated class
        sectorItems.forEach(item => {
            const card = item.querySelector(".services-item");
            if (card) card.classList.add("sector-card-animated");
        });

        gsap.from(sectorItems, {
            y: 50,
            opacity: 0,
            duration: 0.8,
            stagger: 0.12,
            ease: "power2.out",
            scrollTrigger: {
                trigger: ".section-services",
                start: "top 65%"
            }
        });
    }

    /* ==========================================================================
       SECTION 6: Interactive Presence Map Section
       ========================================================================== */
    // Trigger map presence details when map enters viewport (stagger marker pops)
    const mapSection = document.querySelector(".presence-section");
    if (mapSection) {
        gsap.from(".presence-content > *", {
            scrollTrigger: {
                trigger: mapSection,
                start: "top 75%",
                toggleActions: "play none none none"
            },
            y: 40,
            opacity: 0,
            duration: 0.8,
            stagger: 0.15,
            ease: "power3.out"
        });

        gsap.from(".map-container-outer", {
            scrollTrigger: {
                trigger: mapSection,
                start: "top 70%",
                toggleActions: "play none none none"
            },
            scale: 0.95,
            opacity: 0,
            duration: 1,
            ease: "power2.out"
        });

        // Stagger pop markers
        gsap.from(".map-marker", {
            scrollTrigger: {
                trigger: mapSection,
                start: "top 60%",
                toggleActions: "play none none none"
            },
            scale: 0,
            opacity: 0,
            duration: 0.6,
            stagger: 0.08,
            ease: "back.out(1.8)"
        });
    }

    /* ==========================================================================
       SECTION 7: Why Choose Us Section
       ========================================================================== */
    const whyChooseSection = document.querySelector(".why-choose-us");
    if (whyChooseSection) {
        gsap.from(".why-choose-us .title", {
            y: 30,
            opacity: 0,
            duration: 0.6,
            scrollTrigger: {
                trigger: whyChooseSection,
                start: "top 80%"
            }
        });

        gsap.from(".why-choose-us .features .feature-item", {
            y: 40,
            opacity: 0,
            duration: 0.7,
            stagger: 0.15,
            ease: "power2.out",
            scrollTrigger: {
                trigger: whyChooseSection,
                start: "top 70%"
            }
        });
    }

    /* ==========================================================================
       SECTION 8: Trusted Partners Carousel
       ========================================================================== */
    const partnersSection = document.querySelector(".section-faq-list"); // Contains partners slider
    if (partnersSection) {
        const partnersTitle = partnersSection.querySelector("h2");
        if (partnersTitle) {
            gsap.from(partnersTitle, {
                y: 25,
                opacity: 0,
                duration: 0.6,
                scrollTrigger: {
                    trigger: partnersSection,
                    start: "top 80%"
                }
            });
        }

        const partnerLogos = partnersSection.querySelectorAll(".swiper-slide");
        if (partnerLogos.length > 0) {
            gsap.from(partnerLogos, {
                y: 20,
                opacity: 0,
                duration: 0.5,
                stagger: 0.06,
                ease: "power1.out",
                scrollTrigger: {
                    trigger: partnersSection,
                    start: "top 75%"
                }
            });
        }
    }

    /* ==========================================================================
       SECTION 9: Project Stories & Blog Section
       ========================================================================== */
    const blogSection = document.querySelector(".section-blog");
    if (blogSection) {
        const blogTitle = blogSection.querySelector("h2");
        if (blogTitle) {
            gsap.from(blogTitle, {
                y: 30,
                opacity: 0,
                duration: 0.6,
                scrollTrigger: {
                    trigger: blogSection,
                    start: "top 80%"
                }
            });
        }

        const blogCards = blogSection.querySelectorAll(".blog-card-item, .blog-card");
        if (blogCards.length > 0) {
            gsap.from(blogCards, {
                y: 50,
                opacity: 0,
                duration: 0.8,
                stagger: 0.15,
                ease: "power2.out",
                scrollTrigger: {
                    trigger: blogSection,
                    start: "top 70%"
                }
            });
        }
    }

    /* ==========================================================================
       SECTION 10: "We'd Love to Hear From You" / Contact CTA Section
       ========================================================================== */
    const contactSection = document.querySelector(".section-5.h-2"); // Bottom contact section
    if (contactSection) {
        gsap.from(contactSection.querySelector(".title"), {
            y: 30,
            opacity: 0,
            duration: 0.6,
            scrollTrigger: {
                trigger: contactSection,
                start: "top 80%"
            }
        });

        gsap.from(contactSection.querySelectorAll(".contact-info, form"), {
            y: 40,
            opacity: 0,
            duration: 0.8,
            stagger: 0.2,
            ease: "power2.out",
            scrollTrigger: {
                trigger: contactSection,
                start: "top 70%"
            }
        });
    }
});
