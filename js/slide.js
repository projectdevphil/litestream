document.addEventListener('DOMContentLoaded', async () => {
    const sliderContainer = document.getElementById('featured-slider');
    const skeletonContainer = document.getElementById('slider-skeleton');
    
    if (!sliderContainer) return;

    const fetchSlides = async () => {
        try {
            const response = await fetch('/api/getSlides');
            if (!response.ok) throw new Error('Failed to load slides');
            const data = await response.json();
            return data;
        } catch (error) {
            console.error("Slider Data Error:", error);
            return [];
        }
    };

    const renderSlider = (slidesData) => {
        if (skeletonContainer) skeletonContainer.style.display = 'none';
        
        sliderContainer.style.display = 'block';

        if (!slidesData || slidesData.length === 0) return;

        const sliderWrapper = document.createElement('div');
        sliderWrapper.className = 'slider';

        const navWrapper = document.createElement('div');
        navWrapper.className = 'slider-nav';

        slidesData.forEach((data, index) => {
            let slide;
            if (data.link) {
                slide = document.createElement('a');
                slide.href = data.link;
                slide.addEventListener('contextmenu', e => e.preventDefault());
                slide.addEventListener('dragstart', e => e.preventDefault());
            } else {
                slide = document.createElement('div');
            }

            slide.className = index === 0 ? 'slide active' : 'slide';
            
            slide.style.setProperty('--slide-bg', `url('${data.image}')`);

            slide.innerHTML = `
                <img src="${data.image}" alt="${data.title.replace('<br>', ' ')}" class="slide-bg">
                <div class="slide-overlay"></div>
                <div class="slide-content">
                    <h2 class="slide-title">${data.title}</h2>
                    <p class="slide-description">${data.description}</p>
                    <div class="slide-badge visit-badge">${data.badge}</div>
                </div>
            `;

            sliderWrapper.appendChild(slide);

            const dot = document.createElement('button');
            dot.className = index === 0 ? 'dot active' : 'dot';
            dot.ariaLabel = `Go to slide ${index + 1}`;
            navWrapper.appendChild(dot);
        });

        sliderContainer.appendChild(sliderWrapper);
        sliderContainer.appendChild(navWrapper);

        initSliderLogic(sliderWrapper, navWrapper);
    };

    const initSliderLogic = (slider, nav) => {
        const slides = slider.querySelectorAll(".slide");
        const dots = nav.querySelectorAll(".dot");
        
        if (slides.length === 0) return;

        let currentSlide = 0;
        let slideInterval = setInterval(nextSlide, 5000);

        function goToSlide(n) { 
            const index = (n + slides.length) % slides.length;
            slides.forEach((s, i) => s.classList.toggle("active", i === index)); 
            dots.forEach((d, i) => d.classList.toggle("active", i === index)); 
            currentSlide = index;
        }

        function nextSlide() { 
            goToSlide(currentSlide + 1); 
        }

        dots.forEach((dot, index) => {
            dot.addEventListener("click", () => {
                goToSlide(index);
                clearInterval(slideInterval);
                slideInterval = setInterval(nextSlide, 5000);
            });
        });
    };

    const slidesData = await fetchSlides();
    renderSlider(slidesData);
});
