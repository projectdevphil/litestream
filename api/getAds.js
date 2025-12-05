export default function handler(req, res) {
    const referer = req.headers.referer || req.headers.referrer;
    const host = req.headers.host;
    
    if (!referer || !referer.includes(host)) {
        return res.status(403).json({ error: "Access Denied" });
    }

    const adPlaylist = [
        {
            videoUrl: '/assets/ads/112620250001.mp4',
            linkUrl: 'https://www.netflix.com/ph-en/title/81427990?preventIntent=true'
        },
        {
            videoUrl: '/assets/ads/112720250002.mp4',
            linkUrl: 'https://www.netflix.com/ph-en/title/81427990?preventIntent=true'
        },
        {
            videoUrl: '/assets/ads/112720250003.mp4',
            linkUrl: 'https://www.netflix.com/ph-en/title/81427990?preventIntent=true'
        },
        {
            videoUrl: '/assets/ads/112820250004.mp4',
            linkUrl: 'https://dito.ph/'
        },
        {
            videoUrl: '/assets/ads/120220250005.mp4',
            linkUrl: '/home/updates'
        }
    ];

    res.status(200).json(adPlaylist);
}
