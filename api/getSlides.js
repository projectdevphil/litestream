export default function handler(req, res) {
    const referer = req.headers.referer || req.headers.referrer;
    const host = req.headers.host;
    
    if (!referer || !referer.includes(host)) {
        return res.status(403).json({ error: "Access Denied" });
    }

    const slidesData = [
        {
            title: "FPJ's Batang Quiapo",
            description: "<strong>MON-FRI | 8PM</strong><br>Kapamilya Channel, A2Z and TV5",
            image: "https://pql-static.abs-cbn.com/images/batangquiapo.herobg-tv.v3.jpg?im_policy=landscapeHero_tv_hd",
            badge: "Catch-Up TV • Action",
            link: null
        },
        {
            title: "ROJA",
            description: "<strong>MON-FRI | 8:45PM</strong><br>Kapamilya Channel, A2Z and TV5",
            image: "https://occ-0-1763-395.1.nflxso.net/dnm/api/v6/6AYY37jfdO6hpXcMjf9Yu5cnmO0/AAAABQ2QL_Xl927R68dyQNd7mIavq3jzl6TXs2baGhbYVxfZNeMUOlnLsPelcmT2_iKWf0qLeFKMXQd4Dsx57QeHuuO2TS4iIKn3EFKO.webp",
            badge: "Catch-Up TV • Action",
            link: null
        },
        {
            title: "PBB Celebrity Collab<br>Edition 2.0",
            description: "<strong>MON-FRI | 9:40PM<br>SAT | 6:15PM<br>SUN | 10:05PM</strong><br>GMA7 and PBB Catch-Up Episode",
            image: "https://pql-static.abs-cbn.com/images/pbbcelebritycollab.herobg-tv.V4.JPG?im_policy=landscapeHero_tv_hd",
            badge: "Catch-Up TV • Reality",
            link: null
        },
        {
            title: "It's Showtime",
            description: "<strong>MON-SAT | 12NN</strong><br>Kapamilya Channel, A2Z and GMA7",
            image: "https://pql-static.abs-cbn.com/images/itsshowtime.herobg-tv.jpg?im_policy=landscapeHero_tv_fhd",
            badge: "Catch-Up TV • Variety",
            link: null
        },
        {
            title: "NBA TV Philippines",
            description: "<strong>Sports</strong>",
            image: "https://occ-0-1763-395.1.nflxso.net/dnm/api/v6/6AYY37jfdO6hpXcMjf9Yu5cnmO0/AAAABcFuldBLfH2n_0Wiqx4rnmEyjCmJQdy7hbdu7D3ymqfYkqrDcBbgJt9iNU5EbhBzPmU97xqDUYDip3ZSb1y2AFfJdalF4fmaqnP4.webp",
            badge: "Watch Now",
            link: "/home?channel=nba-tv-philippines"
        }
    ];

    res.status(200).json(slidesData);
}
