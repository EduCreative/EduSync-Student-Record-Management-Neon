export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    return res.status(410).json({
        error: 'HTTP database restore is disabled to prevent Vercel 4.5MB payload truncation and partial database corruption.',
        instruction: 'Restore is done from the command line: npm run restore -- <file>'
    });
}
