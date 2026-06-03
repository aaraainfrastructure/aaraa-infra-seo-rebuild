(function ($) {
    "use strict";

    var animateImgItem = function () {
        const isSmallScreen = window.matchMedia("(max-width: 550px)").matches;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const delay =
                            parseFloat(entry.target.getAttribute("data-delay")) || 0;
                        setTimeout(() => {
                            $(entry.target).addClass("active-animate");
                        }, delay * 1000);
                    }
                });
            },
            {
                threshold: isSmallScreen ? 0.1 : 0.1,
            }
        );

        const elements = $(
            ".tf-animate-1, .tf-animate-2, .tf-animate-3, .tf-animate-4"
        );
        elements.each(function () {
            observer.observe(this);
        });

        const checkVisible = () => {
            elements.each(function () {
                const sectionOffsetTop = $(this).offset().top;
                const sectionHeight = $(this).outerHeight();
                const scrollPosition = $(window).scrollTop();
                const windowHeight = $(window).height();

                if (
                    scrollPosition + windowHeight * 0.95 > sectionOffsetTop &&
                    scrollPosition < sectionOffsetTop + sectionHeight
                ) {
                    const delay = parseFloat($(this).attr("data-delay")) || 0;
                    setTimeout(() => {
                        $(this).addClass("active-animate");
                    }, delay * 1000);
                }
            });
        };

        $(document).ready(checkVisible);
        $(window).on("scroll", checkVisible);
    };

    var animateImgScroll = function () {
        if (window.matchMedia("(min-width: 992px)").matches) {
            if ($("div").hasClass("scroll-tranform")) {
                gsap.to(".scroll-tranform", {
                    y: -100,
                    scrollTrigger: {
                        trigger: ".scroll-tranform-section",
                        start: "top center",
                        end: "bottom top",
                        scrub: 3,
                    },
                });
            }
            if ($("div").hasClass("scroll-tranform-up")) {
                gsap.to(".scroll-tranform-up", {
                    y: 100,
                    scrollTrigger: {
                        trigger: ".scroll-tranform-section",
                        start: "top bottom",
                        end: "bottom top",
                        scrub: 3,
                    },
                });
            }
        }
    };

    var animateLines = () => {
        var lines = document.querySelectorAll(".tf-aniamtion-line");

        var show = (el) => {
            var delay = parseFloat(el.getAttribute("data-delay")) || 0;
            gsap.to(el, {
                scaleX: 1,
                duration: 1.2,
                ease: "power2.out",
                delay: delay
            });
        };

        var observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) show(entry.target);
            });
        }, { threshold: 0.1 });

        lines.forEach(line => observer.observe(line));
    };

    $(window).on("load", function () {
        animateImgItem();
        animateImgScroll();
        animateLines();
    });
})(jQuery);
