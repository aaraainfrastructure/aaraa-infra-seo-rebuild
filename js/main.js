/**
 *
 *
 * headerSticky
 * footer
 * changeValue
 * video
 * btnSearch
 * infiniteScroll
 * textRotate
 * counter
 * counterNoAnimation
 * progresslevel
 * totalNumberVariant
 * deleteFile
 * ajaxContactForm
 * progressLevel
 * circlesProgressLevel
 * handleAccordionBorders
 * imageClick
 * handleSidebarFilter
 * goTop
 * preloader
 *
 **/

(function ($) {
    ("use strict");

    var headerSticky = function () {
        let lastScrollTop = 0;
        let delta = 5;
        let ticking = false;
        let a = jQuery;
        function updateHeader() {
            let st = a(window).scrollTop();
            let navbarHeight = a(".header-sticky").outerHeight();
            let adminBarHeight = a("#wpadminbar").length
                ? a("#wpadminbar").outerHeight()
                : 0;

            if (st < 0) st = 0;

            if (st > navbarHeight + 100) {
                a(".header-sticky").addClass("header-bg");
                if (st > lastScrollTop + delta) {
                    a(".header-sticky").css({
                        transform: "translateY(-110%)",
                        top: adminBarHeight,
                    });
                } else if (st < lastScrollTop - delta) {
                    a(".header-sticky").css({
                        transform: "translateY(0%)",
                    });
                }
            } else {
                a(".header-sticky").removeClass("header-bg");
                a(".header-sticky").css({
                    transform: "translateY(0%)",
                    top: adminBarHeight,
                });
            }

            lastScrollTop = st;
            ticking = false;
        }

        a(window).on("scroll", function () {
            if (!ticking) {
                requestAnimationFrame(updateHeader);
                ticking = true;
            }
        });

        updateHeader();
    };

    var footer = function () {
        function checkScreenSize() {
            if (window.matchMedia("(max-width: 550px)").matches) {
                $(".tf-collapse-content").css("display", "none");
            } else {
                $(".footer-menu-list").siblings().removeClass("open");
                $(".tf-collapse-content").css("display", "unset");
            }
        }
        checkScreenSize();
        window.addEventListener("resize", checkScreenSize);
        var args = { duration: 250 };
        $(".title-mobile").on("click", function () {
            $(this).parent(".footer-col-block").toggleClass("open");
            if (!$(this).parent(".footer-col-block").is(".open")) {
                $(this).next().slideUp(args);
            } else {
                $(this).next().slideDown(args);
            }
        });
    };

    var changeValue = function () {
        if ($(".tf-dropdown-sort").length > 0) {
            $(".select-item").click(function (event) {
                $(this)
                    .closest(".tf-dropdown-sort")
                    .find(".text-sort-value")
                    .text($(this).find(".text-value-item").text());

                $(this)
                    .closest(".dropdown-menu")
                    .find(".select-item.active")
                    .removeClass("active");

                $(this).addClass("active");

                var color = $(this).data("value-color");
                $(this)
                    .closest(".tf-dropdown-sort")
                    .find(".btn-select")
                    .find(".current-color")
                    .css("background", color);
            });
        }
    };

    var video = function () {
        if (
            $("div").hasClass("wg-video") ||
            $("div").hasClass("post-format-video") ||
            $("div").hasClass("img-format-video") ||
            $("div").hasClass("wg-curve-text")
        ) {
            $(".popup-youtube, .wg-curve-text-video").magnificPopup({
                type: "iframe",
            });
        }
    };

    var btnSearch = function () {
        $(document).on("click", function (e) {
            if (!$(e.target).closest(".search-btn, .form-search").length) {
                $(".top-search, .search-btn").removeClass("active");
                $("body").removeClass("no-scroll");
            }
        });

        $(".search-btn").on("click", function (e) {
            e.stopPropagation();
            $(".top-search, .search-btn").toggleClass("active");

            if ($(".top-search").hasClass("active")) {
                $("body").addClass("no-scroll");
            } else {
                $("body").removeClass("no-scroll");
            }
        });

        $(".form-search").on("click", function (e) {
            e.stopPropagation();
        });

        $(".button-close").on("click", function () {
            $(".top-search, .search-btn").removeClass("active");
            $("body").removeClass("no-scroll");
        });
    };

    var infiniteScroll = function () {
        if ($("body").hasClass("loadmore")) {
            $(".fl-item").slice(0, 9).show();
            $(".fl-item-1").slice(0, 6).show();
            $(".fl-item-2").slice(0, 9).show();
            $(".fl-item-3").slice(0, 9).show();
            $(".fl-item-4").slice(0, 9).show();
            $(".fl-item-5").slice(0, 12).show();
            if ($(".scroll-loadmore").length > 0) {
                $(window).scroll(function () {
                    if (
                        $(window).scrollTop() >=
                        $(document).height() - $(window).height()
                    ) {
                        setTimeout(() => {
                            $(".fl-item:hidden").slice(0, 4).show();
                            if ($(".fl-item:hidden").length == 0) {
                                $(".view-more-button").hide();
                            }
                        });
                    }
                });
            }
            if ($(".loadmore-item").length > 0) {
                $(".btn-loadmore").on("click", function () {
                    setTimeout(() => {
                        $(".fl-item:hidden").slice(0, 3).show();
                        if ($(".fl-item:hidden").length == 0) {
                            $(".view-more-button").hide();
                        }
                    }, 600);
                });
            }
            if ($(".loadmore-item-1").length > 0) {
                $(".btn-loadmore-1").on("click", function () {
                    setTimeout(() => {
                        $(".fl-item-1:hidden").slice(0, 3).show();
                        if ($(".fl-item-1:hidden").length == 0) {
                            $(".view-more-button-1").hide();
                        }
                    }, 600);
                });
            }
            if ($(".loadmore-item-2").length > 0) {
                $(".btn-loadmore-2").on("click", function () {
                    setTimeout(() => {
                        $(".fl-item-2:hidden").slice(0, 3).show();
                        if ($(".fl-item-2:hidden").length == 0) {
                            $(".view-more-button-2").hide();
                        }
                    }, 600);
                });
            }
            if ($(".loadmore-item-3").length > 0) {
                $(".btn-loadmore-3").on("click", function () {
                    setTimeout(() => {
                        $(".fl-item-3:hidden").slice(0, 3).show();
                        if ($(".fl-item-3:hidden").length == 0) {
                            $(".view-more-button-3").hide();
                        }
                    }, 600);
                });
            }
            if ($(".loadmore-item-4").length > 0) {
                $(".btn-loadmore-4").on("click", function () {
                    setTimeout(() => {
                        $(".fl-item-4:hidden").slice(0, 3).show();
                        if ($(".fl-item-4:hidden").length == 0) {
                            $(".view-more-button-4").hide();
                        }
                    }, 600);
                });
            }
            if ($(".loadmore-item-5").length > 0) {
                $(".btn-loadmore-5").on("click", function () {
                    setTimeout(() => {
                        $(".fl-item-5:hidden").slice(0, 3).show();
                        if ($(".fl-item-5:hidden").length == 0) {
                            $(".view-more-button-5").hide();
                        }
                    }, 600);
                });
            }
        }
    };

    var counter = function () {
        if ($(document.body).hasClass("counter-scroll")) {
            const observer = new IntersectionObserver(
                (entries, observer) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting) {
                            const element = $(entry.target);

                            if (!element.hasClass("odometer-activated")) {
                                const to = element.data("to");
                                element.addClass("odometer-activated");

                                element.html(to);
                            }

                            observer.unobserve(entry.target);
                        }
                    });
                },
                { threshold: 0.5 }
            );

            $(".counter .number").each(function () {
                observer.observe(this);
            });
        }
    };

    var counterNoAnimation = function () {
        if ($(document.body).hasClass("counter-scroll1")) {
            var a = 0;
            $(window).scroll(function () {
                var oTop = $(".counter1").offset().top - window.innerHeight;
                if (a == 0 && $(window).scrollTop() > oTop) {
                    if ($().countTo) {
                        $(".counter1")
                            .find(".number1")
                            .each(function () {
                                var to = $(this).data("to"),
                                    speed = $(this).data("speed");
                                $(this).countTo({
                                    to: to,
                                    speed: speed,
                                });
                            });
                    }
                    a = 1;
                }
            });
        }
    };

    var totalNumberVariant = function () {
        $(".tf-product-info-wrap,.tf-cart-item").each(function () {
            var productItem = $(this);
            var quantityInput = productItem.find(".quantity-product");
            var quantityEl = productItem.find(".quantity-product-2");
            var priceEl = productItem.find(".cart-price");
            var totalEl = productItem.find(".cart-total");

            var updateTotalPrice = function () {
                var currentQuantity = parseInt(quantityInput.val());
                var price = parseFloat(priceEl.text().replace("$", ""));
                var totalPrice = (currentQuantity * price).toFixed(2);
                totalEl.text("$" + totalPrice);
                console.log(totalPrice);
            };

            productItem.find(".btn-increase").on("click", function () {
                var currentQuantity = parseInt(quantityInput.val());
                quantityInput.val(currentQuantity + 1);
                quantityEl.val(currentQuantity + 1);
                updateTotalPrice();
            });

            productItem.find(".btn-decrease").on("click", function () {
                var currentQuantity = parseInt(quantityInput.val());
                if (currentQuantity > 1) {
                    quantityInput.val(currentQuantity - 1);
                    quantityEl.val(currentQuantity - 1);
                    updateTotalPrice();
                }
            });
        });
    };

    var deleteFile = function (e) {
        $(".remove").on("click", function (e) {
            e.preventDefault();
            var $this = $(this);
            $this.closest(".file-delete").remove();
        });
        $(".clear-file-delete").on("click", function (e) {
            e.preventDefault();
            $(this).closest(".list-file-delete").find(".file-delete").remove();
        });
    };

    // Deactivated — Firebase app.js handles contact forms and newsletter
    var ajaxContactForm = function () {};
    var ajaxSubscribe = { eventLoad: function () {}, obj: {} };

    var progressLevel = function () {
        var bars = document.querySelectorAll(".progress-bars-line > div");

        var observer = new IntersectionObserver(
            function (entries, observer) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting && entry.intersectionRatio >= 0.9) {
                        var bar = entry.target;
                        var t1 = parseFloat(bar.dataset.progress);
                        var t2 = parseFloat(bar.dataset.max);
                        var targetWidth = (t1 / t2) * 100;
                        var currentWidth = 25;

                        function animate() {
                            if (currentWidth < targetWidth) {
                                currentWidth += 1;
                                bar.style.width = currentWidth + "%";
                                requestAnimationFrame(animate);
                            } else {
                                bar.style.width = targetWidth + "%";
                            }
                        }

                        animate();
                        observer.unobserve(bar);
                    }
                });
            },
            { threshold: 0.9 }
        );

        bars.forEach(function (bar) {
            bar.style.width = "0%";
            observer.observe(bar);
        });
    };

    var circlesProgressLevel = function () {
        var circles = document.querySelectorAll(".progress-circle1");
        var observer = new IntersectionObserver(
            function (entries, observer) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting && entry.intersectionRatio >= 0.9) {
                        var el = entry.target;
                        var t1 = parseFloat(el.dataset.progress);
                        var t2 = parseFloat(el.dataset.max);
                        var percent = (t1 / t2) * 100;
                        var text = el.querySelector(".progress-text");

                        let progress = 0;
                        function animateCircle() {
                            if (progress < percent) {
                                progress += 1;
                                el.style.background = `conic-gradient(#f25a1e ${progress * 3.6
                                    }deg, #fff 0deg)`;
                                text.textContent = Math.round(progress) + "%";
                                requestAnimationFrame(animateCircle);
                            } else {
                                el.style.background = `conic-gradient(#f25a1e ${percent * 3.6
                                    }deg, #fff 0deg)`;
                                text.textContent = Math.round(percent) + "%";
                            }
                        }

                        animateCircle();
                        observer.unobserve(el);
                    }
                });
            },
            { threshold: 0.9 }
        );
        circles.forEach(function (circle) {
            observer.observe(circle);
        });
    };

    var handleAccordionBorders = function () {
        if (document.querySelector(".according-border")) {
            var accordions = document.querySelectorAll(".according-border .collapse");

            accordions.forEach(function (collapseEl) {
                var parentItem = collapseEl.closest(".according-border");

                var addActiveBorder = function () {
                    parentItem.classList.add("active-border");
                };

                var removeActiveBorder = function () {
                    parentItem.classList.remove("active-border");
                    var nextItem = parentItem.nextElementSibling;
                    if (nextItem && nextItem.classList.contains("according-border")) {
                        nextItem.style.borderTopColor = "";
                    }
                };

                if (collapseEl.classList.contains("show")) {
                    addActiveBorder();
                }

                collapseEl.addEventListener("show.bs.collapse", addActiveBorder);
                collapseEl.addEventListener("hide.bs.collapse", removeActiveBorder);
            });
        }
    };

    var imageClick = function () {
        if ($(".wrap-image-click").length > 0) {
            $(".content-right-item").on("click", function () {
                var link = $(this).data("image");

                var $img = $(this)
                    .closest(".wrap-image-click")
                    .find(".image-left")
                    .find("img");

                $img.fadeOut(200, function () {
                    $img.attr("src", link).attr("data-src", link).fadeIn(200);
                });
            });
        }
    };

    var handleSidebarFilter = function () {
        $("#filterShop,.sidebar-btn").on("click", function () {
            if ($(window).width() <= 1200) {
                $(".sidebar-filter,.overlay-filter").addClass("show");
            }
        });
        $(".close-filter,.overlay-filter").on("click", function () {
            $(".sidebar-filter,.overlay-filter").removeClass("show");
        });
    };

    const oneNavOnePage = () => {
        if (!$(".section-onepage").length) return;

        const $navLinks = $(".nav_link");

        $navLinks.on("click", function (e) {
            e.preventDefault();
            $("html, body").animate(
                { scrollTop: $($(this).attr("href")).offset().top },
                0
            );
        });

        const updateActiveMenu = () => {
            let currentId = "";
            $navLinks.each(function () {
                const $target = $($(this).attr("href"));
                const el = $target[0];
                if (!el) return;

                const rect = el.getBoundingClientRect();
                const inTop = rect.top <= window.innerHeight / 2;
                const notPassedBottom = rect.bottom > window.innerHeight / 4;

                if (inTop && notPassedBottom) {
                    currentId = $(this).attr("href");
                    return false; // thoát each
                }
            });

            $navLinks
                .removeClass("active")
                .filter(`[href="${currentId}"]`)
                .addClass("active");
        };

        $(window).on("scroll resize", updateActiveMenu);
        updateActiveMenu();
    };

    var parallaxImage = function () {
        if ($(".parallax-img").length > 0) {
            $(".parallax-img").each(function () {
                new SimpleParallax(this, {
                    delay: 0.6,
                    orientation: "up",
                    scale: 1.3,
                    transition: "cubic-bezier(0,0,0,1)",
                    customContainer: "",
                    customWrapper: "",
                });
            });
        }
    };

    var gotop = function () {
        if ($("div").hasClass("progress-wrap")) {
            var progressPath = document.querySelector(".progress-wrap path");
            var pathLength = progressPath.getTotalLength();
            progressPath.style.transition = progressPath.style.WebkitTransition =
                "none";
            progressPath.style.strokeDasharray = pathLength + " " + pathLength;
            progressPath.style.strokeDashoffset = pathLength;
            progressPath.getBoundingClientRect();
            progressPath.style.transition = progressPath.style.WebkitTransition =
                "stroke-dashoffset 10ms linear";
            var updateprogress = function () {
                var scroll = $(window).scrollTop();
                var height = $(document).height() - $(window).height();
                var progress = pathLength - (scroll * pathLength) / height;
                progressPath.style.strokeDashoffset = progress;
            };
            updateprogress();
            $(window).scroll(updateprogress);
            var offset = 0;
            var duration = 0;
            jQuery(window).on("scroll", function () {
                if (jQuery(this).scrollTop() > offset) {
                    jQuery(".progress-wrap").addClass("active-progress");
                } else {
                    jQuery(".progress-wrap").removeClass("active-progress");
                }
            });
            jQuery(".progress-wrap").on("click", function (event) {
                event.preventDefault();
                jQuery("html, body").animate({ scrollTop: 0 }, duration);
                return false;
            });
        }
    };

    var preloader = function () {
        setTimeout(function () {
            $(".preload-container").fadeOut("slow", function () {
                $(this).remove();
            });
        }, 400);
    };

    // Dom Ready
    $(function () {
        headerSticky();
        footer();
        changeValue();
        video();
        btnSearch();
        infiniteScroll();
        counter();
        counterNoAnimation();
        totalNumberVariant();
        deleteFile();
        ajaxContactForm();
        ajaxSubscribe.eventLoad();
        progressLevel();
        circlesProgressLevel();
        handleAccordionBorders();
        imageClick();
        handleSidebarFilter();
        oneNavOnePage();
        parallaxImage();
        gotop();
        preloader();
    });
})(jQuery);
