document.addEventListener('DOMContentLoaded', () => {
  // 1. Homepage Burger Toggle
  const rbBurger = document.getElementById('rbBurger');
  const rbPrimaryNav = document.getElementById('rbPrimaryNav');
  
  if (rbBurger && rbPrimaryNav) {
    rbBurger.addEventListener('click', (e) => {
      e.preventDefault();
      const isActive = rbPrimaryNav.classList.toggle('active');
      rbBurger.setAttribute('aria-expanded', isActive ? 'true' : 'false');
    });
  }

  // 2. Homepage Mobile Accordion Menu (toggles first-level submenus on viewport <= 1024px)
  document.querySelectorAll('.rb-menu > .has-sub > a').forEach(link => {
    link.addEventListener('click', (e) => {
      if (window.innerWidth <= 1024) {
        e.preventDefault();
        const parent = link.parentElement;
        
        // Close other sibling submenus
        const siblings = parent.parentElement.children;
        for (const sibling of siblings) {
          if (sibling !== parent && sibling.classList.contains('has-sub')) {
            sibling.classList.remove('active');
          }
        }
        
        parent.classList.toggle('active');
      }
    });
  });

  // 3. Homepage Mobile Second-level Nested Menu (.has-sub-2 on viewport <= 1024px)
  document.querySelectorAll('.rb-submenu > .has-sub-2 > a').forEach(link => {
    link.addEventListener('click', (e) => {
      if (window.innerWidth <= 1024) {
        e.preventDefault();
        const parent = link.parentElement;
        
        // Close other sibling nested submenus
        const siblings = parent.parentElement.children;
        for (const sibling of siblings) {
          if (sibling !== parent && sibling.classList.contains('has-sub-2')) {
            sibling.classList.remove('active');
          }
        }
        
        parent.classList.toggle('active');
      }
    });
  });

  // 4. Standalone Legacy Toggle Fallback
  const menuToggle = document.getElementById('menu-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener('click', () => {
      mobileMenu.style.display = mobileMenu.style.display === 'flex' ? 'none' : 'flex';
    });
  }
});