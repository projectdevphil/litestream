// js/slider.js

const { useState, useEffect } = React;
const { motion, AnimatePresence } = window.Motion;

// Slide Data
const slides = [
    {
        id: 1,
        title: "FPJ's Batang Quiapo",
        desc: "MON-FRI | 8PM",
        subDesc: "Kapamilya Channel, A2Z and TV5",
        badge: "Catch-Up TV • Action",
        image: "https://pql-static.abs-cbn.com/images/batangquiapo.herobg-tv.v3.jpg?im_policy=landscapeHero_tv_hd",
        color: "#7f1d1d" // Red
    },
    {
        id: 2,
        title: "ROJA",
        desc: "MON-FRI | 8:45PM",
        subDesc: "Kapamilya Channel, A2Z and TV5",
        badge: "Catch-Up TV • Action",
        image: "https://occ-0-1763-395.1.nflxso.net/dnm/api/v6/6AYY37jfdO6hpXcMjf9Yu5cnmO0/AAAABQ2QL_Xl927R68dyQNd7mIavq3jzl6TXs2baGhbYVxfZNeMUOlnLsPelcmT2_iKWf0qLeFKMXQd4Dsx57QeHuuO2TS4iIKn3EFKO.webp",
        color: "#c2410c" // Orange
    },
    {
        id: 3,
        title: "PBB Celebrity Collab",
        desc: "MON-SUN | VARIOUS TIMES",
        subDesc: "GMA7 and PBB Catch-Up Episode",
        badge: "Catch-Up TV • Reality",
        image: "https://pql-static.abs-cbn.com/images/pbbcelebritycollab.herobg-tv.V4.JPG?im_policy=landscapeHero_tv_hd",
        color: "#1e40af" // Blue
    },
    {
        id: 4,
        title: "It's Showtime",
        desc: "MON-SAT | 12NN",
        subDesc: "Kapamilya Channel, A2Z and GMA7",
        badge: "Catch-Up TV • Variety",
        image: "https://pql-static.abs-cbn.com/images/itsshowtime.herobg-tv.jpg?im_policy=landscapeHero_tv_fhd",
        color: "#86198f" // Purple
    },
    {
        id: 5,
        title: "NBA TV Philippines",
        desc: "Sports",
        subDesc: "Watch Now",
        badge: "Live",
        image: "https://occ-0-1763-395.1.nflxso.net/dnm/api/v6/6AYY37jfdO6hpXcMjf9Yu5cnmO0/AAAABcFuldBLfH2n_0Wiqx4rnmEyjCmJQdy7hbdu7D3ymqfYkqrDcBbgJt9iNU5EbhBzPmU97xqDUYDip3ZSb1y2AFfJdalF4fmaqnP4.webp",
        color: "#1d4ed8" // Blue
    }
];

const FeaturedSlider = () => {
    const [index, setIndex] = useState(0);

    // Auto-play logic
    useEffect(() => {
        const timer = setInterval(() => {
            setIndex((prev) => (prev + 1) % slides.length);
        }, 6000); // 6 seconds
        return () => clearInterval(timer);
    }, []);

    const currentSlide = slides[index];

    return (
        <div className="relative w-full px-5 py-5 overflow-hidden">
            
            {/* 1. Dynamic Shadow Gradient (Background Glow) */}
            <motion.div 
                animate={{ 
                    background: `radial-gradient(circle at 50% 50%, ${currentSlide.color}80 0%, transparent 70%)` 
                }}
                transition={{ duration: 1.5 }}
                className="absolute inset-0 opacity-40 blur-[80px] pointer-events-none"
            />

            {/* Slider Container */}
            <div className="relative w-full aspect-video md:aspect-[21/9] lg:h-[500px] bg-[#111] rounded-[20px] overflow-hidden shadow-2xl z-10 border border-white/10">
                <AnimatePresence initial={false} mode="popLayout">
                    <motion.div
                        key={currentSlide.id}
                        className="absolute inset-0 w-full h-full flex"
                        
                        // 2. The Pulling Animation (Right to Left)
                        initial={{ x: "100%", opacity: 0.8 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: "-30%", opacity: 0.5, filter: "brightness(0.5)" }} 
                        
                        transition={{ 
                            type: "spring", 
                            stiffness: 200, 
                            damping: 25,
                            mass: 1
                        }}
                        style={{ 
                            zIndex: 10,
                            // 3. Vertical Divider Look (via Border Radius & Border)
                            borderLeft: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "0px" 
                        }}
                    >
                        {/* Slide Image */}
                        <img 
                            src={currentSlide.image} 
                            alt={currentSlide.title} 
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                        
                        {/* Gradient Overlay for Text Readability */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
                        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-transparent"></div>

                        {/* Content Container */}
                        <div className="relative z-20 flex flex-col justify-end h-full p-6 md:p-12 w-full max-w-3xl">
                            
                            {/* 4. Text Slide Up Animation */}
                            <motion.div
                                initial={{ y: 50, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.4, duration: 0.6, ease: "easeOut" }}
                            >
                                <span className="inline-block bg-white text-black text-[10px] md:text-xs font-bold px-2 py-1 rounded mb-3 shadow-lg tracking-wider uppercase">
                                    {currentSlide.badge}
                                </span>
                                
                                <h2 className="text-2xl md:text-5xl font-bold text-white mb-2 leading-tight drop-shadow-md">
                                    {currentSlide.title}
                                </h2>
                                
                                <div className="h-1 w-16 bg-white/50 mb-3 rounded-full"></div>
                                
                                <p className="text-xs md:text-base text-gray-200 font-medium mb-1 drop-shadow">
                                    {currentSlide.desc}
                                </p>
                                
                                <p className="text-[10px] md:text-sm text-gray-400">
                                    {currentSlide.subDesc}
                                </p>
                            </motion.div>
                        </div>
                    </motion.div>
                </AnimatePresence>

                {/* Navigation Dots */}
                <div className="absolute bottom-6 right-6 flex gap-2 z-30">
                    {slides.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setIndex(i)}
                            className={`h-1.5 rounded-full transition-all duration-300 shadow-sm ${
                                i === index ? 'w-8 bg-white' : 'w-2 bg-white/40 hover:bg-white/70'
                            }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

// Mount the React Component
const root = ReactDOM.createRoot(document.getElementById('react-slider-root'));
root.render(<FeaturedSlider />);
