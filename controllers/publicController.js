const Pet = require('../models/Pet');
const User = require('../models/User');

/**
 * @desc    Render public pet scan page (HTML)
 * @route   GET /scan/:tagId
 * @access  Public
 */
exports.renderScanPage = async (req, res, next) => {
    console.log(`Scan request received for tagId: ${req.params.tagId}`);
    try {
        const pet = await Pet.findOne({ tagId: req.params.tagId, isActive: true })
            .populate('userId', 'name email phone');

        if (!pet) {
            return res.status(404).send(`
                <div style="font-family: sans-serif; text-align: center; padding: 50px;">
                    <h1 style="color: #6366f1;">404 - Pet Tag Not Found</h1>
                    <p>This QR code does not seem to be registered in our system.</p>
                    <a href="/" style="display: inline-block; margin-top: 20px; color: #6366f1;">Back to home</a>
                </div>
            `);
        }

        const isLost = pet.isLost;

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pet.name}'s Profile - PetVitals SOS</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #6366f1;
            --primary-dark: #4f46e5;
            --secondary: #ec4899;
            --bg: #0f172a;
            --surface: #1e293b;
            --text: #f8fafc;
            --text-muted: #94a3b8;
            --error: #ef4444;
            --success: #10b981;
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
            position: relative;
        }
        .sos-banner {
            background: var(--error);
            color: white;
            padding: 10px;
            text-align: center;
            font-weight: 700;
            font-size: 14px;
            letter-spacing: 1px;
            display: ${isLost ? 'block' : 'none'};
        }
        .header {
            background: ${isLost ? 'linear-gradient(135deg, #ef4444, #991b1b)' : 'linear-gradient(135deg, #6366f1, #3730a3)'};
            padding: 40px 20px;
            text-align: center;
        }
        .pet-photo-container {
            position: relative;
            width: 130px;
            height: 130px;
            margin: 0 auto;
        }
        .pet-photo {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            border: 4px solid white;
            background: #cbd5e1;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 60px;
            object-fit: cover;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
        }
        .lost-badge {
            position: absolute;
            bottom: 0;
            right: 0;
            background: var(--error);
            color: white;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 10px;
            font-weight: 800;
            border: 2px solid white;
            display: ${isLost ? 'block' : 'none'};
        }
        .pet-name { margin-top: 15px; font-size: 28px; font-weight: 700; }
        .pet-type { font-size: 16px; opacity: 0.8; font-weight: 300; }
        
        .content { padding: 25px; }
        .section { margin-bottom: 25px; background: rgba(255,255,255,0.03); padding: 20px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05); }
        .section-title { 
            font-size: 13px; 
            text-transform: uppercase; 
            color: var(--text-muted); 
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 800;
            letter-spacing: 0.5px;
        }
        .message-box {
            background: rgba(239, 68, 68, 0.1);
            border-left: 4px solid var(--error);
            padding: 15px;
            border-radius: 0 12px 12px 0;
            margin-bottom: 20px;
            display: ${isLost ? 'block' : 'none'};
        }
        .message-text { font-size: 15px; color: var(--text); }

        .owner-details {
            display: flex;
            flex-direction: column;
            gap: 12px;
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
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .contact-btn:hover { background: var(--primary-dark); transform: translateY(-2px); }
        .contact-btn.tel { background: var(--success); }
        .contact-btn.secondary {
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.1);
        }
        
        .medical-text {
            font-size: 14px;
            color: var(--text-muted);
            white-space: pre-wrap;
        }

        .footer-note {
            text-align: center;
            font-size: 11px;
            color: var(--text-muted);
            margin-top: 10px;
            padding: 20px;
            opacity: 0.7;
        }
        .logo-text { font-weight: 700; color: var(--primary); }
    </style>
</head>
<body>
    <div class="container">
        <div class="sos-banner">🚨 EMERGENCY: I AM LOST 🚨</div>
        
        <div class="header">
            <div class="pet-photo-container">
                ${pet.photo
                ? `<img src="${pet.photo}" class="pet-photo" alt="${pet.name}">`
                : `<div class="pet-photo">${pet.type === 'Dog' ? '🐕' : pet.type === 'Cat' ? '🐈' : '🐾'}</div>`
            }
                <div class="lost-badge">LOST</div>
            </div>
            <h1 class="pet-name">${pet.name}</h1>
            <p class="pet-type">${pet.breed || pet.type} • ${pet.gender}</p>
        </div>

        <div class="content">
            <div class="message-box">
                <p class="message-text"><strong>Owner's Note:</strong> Please help me find my way back home! My owner is worried.</p>
            </div>

            <div class="section">
                <div class="section-title">👤 Owner Contact Information</div>
                <div class="owner-details">
                    <p style="text-align: center; font-size: 18px; font-weight: 700; margin-bottom: 5px; color: white;">${pet.userId.name}</p>
                    <a href="tel:${pet.userId.phone}" class="contact-btn tel">
                        📞 Call ${pet.userId.phone}
                    </a>
                    <a href="mailto:${pet.userId.email}" class="contact-btn secondary">
                        ✉️ Send Email
                    </a>
                </div>
            </div>

            ${pet.publicMedicalInfo || pet.notes ? `
            <div class="section">
                <div class="section-title">🏥 Important Medical Info</div>
                <div class="medical-text">${pet.publicMedicalInfo || pet.notes}</div>
            </div>
            ` : ''}

            <div style="text-align: center; margin-top: 10px;">
                <p style="font-size: 12px; color: var(--text-muted);">Thank you for helping ${pet.name}!</p>
            </div>
        </div>

        <div class="footer-note">
            This QR Page was generated by <span class="logo-text">PetVitals Hub</span><br>
            A secure way to keep pets safe 24/7.
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
