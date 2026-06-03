/* =========================================================
   AARAA BLOG – CLEAN & FINAL SCRIPT
   (Lightbox + FAQ + Carousel + Time)
========================================================= */

document.addEventListener('DOMContentLoaded', () => {

    /* =====================================================
       LIVE IST DATE & TIME
    ===================================================== */
    const liveDatetime = document.getElementById('liveDatetime');
    if (liveDatetime) {
        const updateISTTime = () => {
            const now = new Date();
            liveDatetime.innerText = now.toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                year: 'numeric',
                month: 'long',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        };
        updateISTTime();
        setInterval(updateISTTime, 1000);
    }

    /* =====================================================
       FOOTER – CURRENT YEAR
    ===================================================== */
    const copyrightEl = document.getElementById('copyrightText');
    if (copyrightEl) {
        copyrightEl.innerHTML = copyrightEl.innerHTML.replace(
            /\d{4}/,
            new Date().getFullYear()
        );
    }

    /* =====================================================
       FAQ – CSS-DRIVEN TOGGLE
    ===================================================== */
    window.toggleFaq = function (questionEl) {
        const item = questionEl.closest('.faq-item');
        const isActive = item.classList.contains('active');

        document.querySelectorAll('.faq-item').forEach(faq => {
            faq.classList.remove('active');
        });

        if (!isActive) item.classList.add('active');
    };

    /* =====================================================
       LIGHTBOX – IMAGES + VIDEOS (UNIFIED)
    ===================================================== */
    const lightbox = document.getElementById('lightbox');
    const lightboxContent = document.getElementById('lightboxContent');
    const lightboxCounter = document.getElementById('lightboxCounter');

    let galleryItems = [];
    let galleryIndex = 0;

    function renderLightbox() {
        if (!galleryItems.length) return;

        const item = galleryItems[galleryIndex];
        lightboxContent.innerHTML = '';

        if (item.type === 'video') {
            const iframe = document.createElement('iframe');
            iframe.src = item.src;
            iframe.allow =
                'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
            iframe.allowFullscreen = true;
            lightboxContent.appendChild(iframe);
        } else {
            const img = document.createElement('img');
            img.src = item.src;
            img.alt = item.alt || 'Project Visual';
            lightboxContent.appendChild(img);
        }

        lightboxCounter.innerText =
            galleryItems.length > 1
                ? `${galleryIndex + 1} / ${galleryItems.length}`
                : '';
    }

    window.openLightbox = function (index, items = galleryItems) {
        galleryItems = items;
        galleryIndex = index;
        lightbox.classList.add('active');
        renderLightbox();
    };

    window.closeLightbox = function (e) {
        if (
            e.target.id === 'lightbox' ||
            e.target.classList.contains('lightbox-close')
        ) {
            lightbox.classList.remove('active');
            lightboxContent.innerHTML = '';
        }
    };

    window.changeLightboxImage = function (step, e) {
        e.stopPropagation();
        galleryIndex =
            (galleryIndex + step + galleryItems.length) % galleryItems.length;
        renderLightbox();
    };

    document.addEventListener('keydown', e => {
        if (!lightbox.classList.contains('active')) return;
        if (e.key === 'ArrowRight') changeLightboxImage(1, e);
        if (e.key === 'ArrowLeft') changeLightboxImage(-1, e);
        if (e.key === 'Escape') closeLightbox(e);
    });

    /* =====================================================
       PROJECT VISUALS → LIGHTBOX SOURCE
    ===================================================== */
    const visualCards = document.querySelectorAll('.visual-card');
    const visualGallery = Array.from(visualCards).map(card => {
        const img = card.querySelector('img');
        return {
            type: card.dataset.type || 'image',
            src: card.dataset.video || img.src.replace(/w=800.*$/, 'w=1600'),
            alt: img.alt
        };
    });

    visualCards.forEach((card, i) => {
        card.onclick = () => openLightbox(i, visualGallery);
    });
	
	/* =====================================================
   PROJECT VISUALS – ARROW SCROLL (FIX)
===================================================== */

const visualsCarousel = document.getElementById('visualsCarousel');

if (visualsCarousel) {
    let visualsIndex = 0;
    const visualsCards = visualsCarousel.querySelectorAll('.visual-card');

    function visualsCardWidth() {
        return visualsCards[0].getBoundingClientRect().width + 15;
    }

    window.scrollVisuals = function (dir) {
        visualsIndex += dir;

        if (visualsIndex < 0) visualsIndex = visualsCards.length - 1;
        if (visualsIndex >= visualsCards.length) visualsIndex = 0;

        visualsCarousel.style.transform =
            `translateX(-${visualsIndex * visualsCardWidth()}px)`;
    };
}



    /* =====================================================
       EXPLORE MORE PROJECTS – CAROUSEL
    ===================================================== */
    const carousel = document.getElementById('projectsCarousel');
    if (!carousel) return;

    const cards = carousel.querySelectorAll('.project-card');
    if (!cards.length) return;

    let index = 0;
    let autoScroll;

    function cardWidth() {
        return cards[0].getBoundingClientRect().width + 15;
    }

    window.scrollCarousel = function (dir) {
        index += dir;
        if (index < 0) index = cards.length - 1;
        if (index >= cards.length) index = 0;

        carousel.style.transform =
            `translateX(-${index * cardWidth()}px)`;
    };

    function startAutoScroll() {
        clearInterval(autoScroll);
        autoScroll = setInterval(() => scrollCarousel(1), 3500);
    }

    function stopAutoScroll() {
        clearInterval(autoScroll);
    }

    startAutoScroll();

    carousel.addEventListener('mouseenter', stopAutoScroll);
    carousel.addEventListener('mouseleave', startAutoScroll);

    /* Touch swipe */
    let startX = 0;

    carousel.addEventListener('touchstart', e => {
        startX = e.touches[0].clientX;
        stopAutoScroll();
    }, { passive: true });

    carousel.addEventListener('touchend', e => {
        const diff = startX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 40) {
            scrollCarousel(diff > 0 ? 1 : -1);
        }
        startAutoScroll();
    }, { passive: true });

    /* Click project image → lightbox */
    cards.forEach(card => {
        const img = card.querySelector('img');
        if (!img) return;

        img.style.cursor = 'pointer';
        img.onclick = e => {
            e.stopPropagation();
            openLightbox(0, [{
                type: 'image',
                src: img.src,
                alt: img.alt
            }]);
        };
    });

});

/* ==========================================
   CALL BACK POPUP + FORM SUBMIT
========================================== */

function openCallbackPopup() {
    document.getElementById('callbackPopup').classList.add('active');
}

function closeCallbackPopup() {
    document.getElementById('callbackPopup').classList.remove('active');
}

/* Submit form */
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('callbackForm');
    if (!form) return;

    form.addEventListener('submit', e => {
        e.preventDefault();

        const message = document.getElementById('callbackMessage');
        message.innerText = 'Submitting...';

        fetch('callback.php', {
            method: 'POST',
            body: new FormData(form)
        })
        .then(res => res.text())
        .then(res => {
            if (res.trim() === 'success') {
                message.style.color = 'green';
                message.innerText = 'Request submitted successfully!';
                form.reset();
                setTimeout(closeCallbackPopup, 2000);
            } else {
                message.style.color = 'red';
                message.innerText = 'Something went wrong. Please try again.';
            }
        })
        .catch(() => {
            message.style.color = 'red';
            message.innerText = 'Server error. Please try later.';
        });
    });
});
