const Pet = require('../models/Pet');
const User = require('../models/User');

/**
 * @desc    Render public pet scan page (HTML)
 * @route   GET /scan/:tagId
 * @access  Public
 */
exports.renderScanPage = async (req, res, next) => {
    try {
        const pet = await Pet.findOne({ tagId: req.params.tagId, isActive: true })
            .populate('userId', 'name email phone');

        if (!pet) {
            return res.status(404).send('<h1>Pet tag not found</h1>');
        }

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pet.name}'s Profile - PetVitals</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #6366f1;
            --primary-dark: #4f46e5;
            --bg: #0f172a;
            --surface: #1e293b;
            --text: #f8fafc;
            --text-muted: #94a3b8;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Outfit', sans-serif; 
            background: var(--bg);
            color: var(--text);
            line-height: 1.6;
            display: flex;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            width: 100%;
            max-width: 500px;
            background: var(--surface);
            border-radius: 30px;
            overflow: hidden;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(255,255,255,0.1);
        }
        .header {
            background: linear-gradient(135deg, #6366f1, #3730a3);
            padding: 40px 20px;
            text-align: center;
        }
        .pet-photo {
            width: 120px;
            height: 120px;
            border-radius: 60px;
            border: 4px solid white;
            margin: 0 auto;
            background: #cbd5e1;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 60px;
            object-fit: cover;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
        }
        .pet-name { margin-top: 15px; font-size: 28px; font-weight: 700; }
        .pet-type { font-size: 16px; opacity: 0.8; font-weight: 300; }
        
        .content { padding: 30px; }
        .section { margin-bottom: 25px; }
        .section-title { 
            font-size: 14px; 
            text-transform: uppercase; 
            color: var(--text-muted); 
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 600;
        }
        .owner-details {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        .contact-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            background: var(--primary);
            color: white;
            text-decoration: none;
            padding: 16px;
            border-radius: 16px;
            font-weight: 600;
            transition: 0.3s;
        }
        .contact-btn:hover { background: var(--primary-dark); transform: translateY(-2px); }
        .contact-btn.secondary {
            background: rgba(255,255,255,0.1);
        }
        .footer-note {
            text-align: center;
            font-size: 12px;
            color: var(--text-muted);
            margin-top: 20px;
            padding: 20px;
            border-top: 1px solid rgba(255,255,255,0.05);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            ${pet.photo
                ? `<img src="${pet.photo}" class="pet-photo" alt="${pet.name}">`
                : `<div class="pet-photo">${pet.type === 'Dog' ? '🐕' : pet.type === 'Cat' ? '🐈' : '🐾'}</div>`
            }
            <h1 class="pet-name">${pet.name}</h1>
            <p class="pet-type">${pet.breed || pet.type} • ${pet.gender}</p>
        </div>

        <div class="content">
            <div class="section">
                <div class="section-title"><span>👤</span> Owner Contact Details</div>
                <div class="owner-details">
                    <p style="text-align: center; font-size: 18px; font-weight: 600; margin-bottom: 10px;">${pet.userId.name}</p>
                    <a href="tel:${pet.userId.phone}" class="contact-btn">
                        📞 Call Owner
                    </a>
                    <a href="mailto:${pet.userId.email}" class="contact-btn secondary">
                        ✉️ Send Email
                    </a>
                </div>
            </div>
        </div>

        <div class="footer-note">
            Powered by <strong>PetVitals Hub</strong><br>
            Fastest way to reconnect pets with their owners.
        </div>
    </div>
</body>
</html>
        `;

        res.status(200).send(html);
    } catch (error) {
        next(error);
    }
};

// const Pet = require('../models/Pet');

/**
 * @desc    Get pet profile by tag ID (Public)
 * @route   GET /api/public/pet/:tagId
 * @access  Public
 */
exports.getPetByTagId = async (req, res, next) => {
    try {
        const pet = await Pet.findOne({ tagId: req.params.tagId, isActive: true })
            .populate('userId', 'name email phone');

        if (!pet) {
            return res.status(404).json({
                success: false,
                message: 'Pet tag not found',
            });
        }

        // Return only what's necessary for the public profile
        res.status(200).json({
            success: true,
            data: {
                name: pet.name,
                type: pet.type,
                breed: pet.breed,
                photo: pet.photo,
                owner: {
                    name: pet.userId.name,
                    phone: pet.userId.phone,
                    email: pet.userId.email
                }
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Report pet scan location (Public)
 * @route   POST /api/public/pet/:tagId/scan
 * @access  Public
 */
/*
exports.reportScan = async (req, res, next) => {
    try {
        const { lat, lng, address } = req.body;
        const pet = await Pet.findOne({ tagId: req.params.tagId, isActive: true });

        if (!pet) {
            return res.status(404).json({
                success: false,
                message: 'Pet tag not found',
            });
        }

        // In a real app, this would send a push notification to the owner
        // "Your pet [PetName]'s tag was just scanned at [Address]!"

        console.log(`Pet ${pet.name} (${pet.tagId}) scanned at: ${lat}, ${lng} - ${address}`);

        res.status(200).json({
            success: true,
            message: 'Notification sent to owner',
        });
    } catch (error) {
        next(error);
    }
};
*/
