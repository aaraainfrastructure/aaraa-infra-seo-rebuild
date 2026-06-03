if ($(".tf-sw-slideshow").length > 0) {
    var tfSwSlideshow = $(".tf-sw-slideshow");
    var preview = tfSwSlideshow.data("preview");
    var tablet = tfSwSlideshow.data("tablet");
    var mobile = tfSwSlideshow.data("mobile");
    var spacing = tfSwSlideshow.data("space");
    var spacingMb = tfSwSlideshow.data("space-mb");
    var loop = tfSwSlideshow.data("loop");
    var play = tfSwSlideshow.data("auto-play");
    var centered = tfSwSlideshow.data("centered");
    var effect = tfSwSlideshow.data("effect");
    var speed =
        tfSwSlideshow.data("speed") !== undefined
            ? tfSwSlideshow.data("speed")
            : 1000;
    var swiperSlider = {
        autoplay: play
            ? {
                delay: 5000,
                disableOnInteraction: false,
                pauseOnMouseEnter: true,
            }
            : false,
        slidesPerView: mobile,
        loop: loop,
        spaceBetween: spacingMb,
        speed: speed,
        observer: true,
        observeParents: true,
        pagination: {
            el: ".sw-pagination-slider",
            clickable: true,
        },
        navigation: {
            clickable: true,
            nextEl: ".navigation-next-slider",
            prevEl: ".navigation-prev-slider",
        },
        centeredSlides: false,
        breakpoints: {
            768: {
                slidesPerView: tablet,
                spaceBetween: spacing,
                centeredSlides: false,
            },
            1200: {
                slidesPerView: preview,
                spaceBetween: spacing,
                centeredSlides: centered,
            },
        },
    };
    if (effect === "fade") {
        swiperSlider.effect = "fade";
        swiperSlider.fadeEffect = {
            crossFade: true,
        };
    }
    var swiper = new Swiper(".tf-sw-slideshow", swiperSlider);
}

if ($(".tf-swiper").length > 0) {
    $(".tf-swiper").each(function () {
        const config = $(this).data("swiper");
        if (this.swiper) {
            this.swiper.destroy(true, true);
        }
        new Swiper(this, config);
    });
}

if ($(".flat-thumbs-tes").length > 0) {
    var spaceThumbLg = $(".tf-thumb-tes").data("space-lg");
    var spaceThumb = $(".tf-thumb-tes").data("space");
    var spaceTesLg = $(".tf-tes-main").data("space-lg");
    var spaceTes = $(".tf-tes-main").data("space");
    var effect = $(".flat-thumbs-tes").data("effect") || "slide";
    const swThumb = new Swiper(".tf-thumb-tes", {
        speed: 800,
        spaceBetween: spaceThumb,
        effect: effect, 
        fadeEffect: effect === "fade" ? { crossFade: true } : undefined,
        breakpoints: {
            768: {
                spaceBetween: spaceThumbLg,
            },
        },
        
    });
    const swTesMain = new Swiper(".tf-tes-main", {
        speed: 800,
        navigation: {
            nextEl: ".nav-next-tes",
            prevEl: ".nav-prev-tes",
        },
        effect: effect, 
        fadeEffect: effect === "fade" ? { crossFade: true } : undefined,
        pagination: {
            el: ".sw-pagination-tes",
            clickable: true,
        },
        spaceBetween: spaceTes,
        breakpoints: {
            768: {
                spaceBetween: spaceTesLg,
            },
        },
    });

    swThumb.controller.control = swTesMain;
    swTesMain.controller.control = swThumb;
}

if ($(".thumbs-sw-pagi").length > 0) {

    var spacing = $(".thumbs-sw-pagi").data("space");

    var pagithumbs = new Swiper(".thumbs-sw-pagi", {
        slidesPerView: "auto",
        spaceBetween: spacing,
        freeMode: true,
        watchSlidesProgress: true,
        navigation: {
            clickable: true,
            nextEl: ".sw-pagi-next",
            prevEl: ".sw-pagi-prev",
        },
    });
}

if ($(".sw-single-1").length > 0) {
    var spacing = $(".sw-single-1").data("space");
    var loop = $(".sw-single-1").data("loop") || false;
    var swiperSingle = new Swiper(".sw-single-1", {
        spaceBetween: spacing,
        autoplay: {
            delay: 5000,
            disableOnInteraction: false,
            pauseOnMouseEnter: true,
        },
        speed: 800,
        effect: "fade",
        fadeEffect: {
            crossFade: true,
        },
        thumbs: {
            swiper: pagithumbs,
        },
        navigation: {
            clickable: true,
            nextEl: ".sw-thumbs-next",
            prevEl: ".sw-thumbs-prev",
        },
    });
}
