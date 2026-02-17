const Pet = require('../models/Pet');
const User = require('../models/User');
const HealthRecord = require('../models/HealthRecord');

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

/**
 * @desc    Render public medical vault page
 * @route   GET /vault/:shareToken
 * @access  Public
 */
exports.renderVaultPage = async (req, res, next) => {
    try {
        const pet = await Pet.findOne({ vaultShareToken: req.params.shareToken, medicalVaultActive: true })
            .populate('userId', 'name email phone');

        if (!pet) {
            return res.status(404).send(`
                <div style="font-family: sans-serif; text-align: center; padding: 50px;">
                    <h1 style="color: #6366f1;">Vault Not Found or Inactive</h1>
                    <p>This shareable link is either invalid or the owner has disabled vault sharing.</p>
                </div>
            `);
        }

        const records = await HealthRecord.find({ petId: pet._id }).sort({ date: -1 });

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Medical Vault: ${pet.name} - PetVitals Hub</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #6366f1;
            --secondary: #ec4899;
            --bg: #f8fafc;
            --surface: #ffffff;
            --text: #1e293b;
            --text-muted: #64748b;
            --border: #e2e8f0;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Outfit', sans-serif; 
            background: var(--bg);
            color: var(--text);
            padding: 20px;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: var(--surface);
            padding: 40px;
            border-radius: 24px;
            box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);
            border: 1px solid var(--border);
        }
        .header {
            display: flex;
            align-items: center;
            gap: 25px;
            margin-bottom: 40px;
            padding-bottom: 30px;
            border-bottom: 2px solid var(--border);
        }
        .pet-photo {
            width: 100px;
            height: 100px;
            border-radius: 20px;
            object-fit: cover;
            background: #cbd5e1;
        }
        .pet-info h1 { font-size: 32px; font-weight: 700; color: var(--primary); }
        .pet-info p { color: var(--text-muted); font-size: 16px; }

        .section { margin-bottom: 40px; }
        .section-title { font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); font-weight: 800; margin-bottom: 20px; }
        
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .card { background: var(--bg); padding: 15px; border-radius: 12px; border: 1px solid var(--border); }
        .card-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; }
        .card-value { font-size: 16px; font-weight: 600; margin-top: 4px; }

        .record-card {
            padding: 20px;
            border: 1px solid var(--border);
            border-radius: 16px;
            margin-bottom: 15px;
            transition: 0.2s;
        }
        .record-type {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 8px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            margin-bottom: 10px;
        }
        .type-vaccination { background: #dcfce7; color: #166534; }
        .type-medication { background: #dbeafe; color: #1e40af; }
        .type-vet_visit { background: #fef9c3; color: #854d0e; }
        .type-prescription { background: #f3e8ff; color: #6b21a8; }
        .type-lab_report { background: #ffe4e6; color: #9f1239; }
        .type-x_ray { background: #f1f5f9; color: #475569; }

        .record-title { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
        .record-date { font-size: 13px; color: var(--text-muted); margin-bottom: 10px; }
        .record-detail { font-size: 14px; margin-top: 5px; color: var(--text); }
        .record-detail strong { color: var(--text-muted); font-weight: 600; font-size: 12px; }

        .attachment-link {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin-top: 15px;
            color: var(--primary);
            text-decoration: none;
            font-weight: 600;
            font-size: 13px;
        }

        @media (max-width: 600px) {
            .container { padding: 25px; }
            .header { flex-direction: column; text-align: center; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div style="text-align: right; margin-bottom: 20px;">
            <span style="font-size: 12px; font-weight: 800; color: #10b981; padding: 5px 12px; background: #dcfce7; border-radius: 20px;">✓ OFFICIAL MEDICAL VAULT</span>
        </div>

        <div class="header">
            ${pet.photo
                ? `<img src="${pet.photo}" class="pet-photo" alt="${pet.name}">`
                : `<div class="pet-photo" style="display:flex;align-items:center;justify-content:center;font-size:40px;">🐾</div>`
            }
            <div class="pet-info">
                <h1>${pet.name}</h1>
                <p>${pet.breed || pet.type} • ${pet.gender} • ${pet.age || '--'} Years Old</p>
                <p style="font-size: 14px; margin-top: 5px;">Owner: ${pet.userId.name}</p>
            </div>
        </div>

        <div class="section">
            <div class="section-title">🏥 Basic Vitals</div>
            <div class="grid">
                <div class="card">
                    <div class="card-label">Weight</div>
                    <div class="card-value">${pet.weight || '--'} ${pet.weightUnit}</div>
                </div>
                <div class="card">
                    <div class="card-label">Age</div>
                    <div class="card-value">${pet.age || '--'} years</div>
                </div>
                <div class="card">
                    <div class="card-label">Type</div>
                    <div class="card-value">${pet.type}</div>
                </div>
            </div>
        </div>

        <div class="section">
            <div class="section-title">📜 Medical Records & Documents</div>
            ${records.length === 0 ? '<p style="color:var(--text-muted)">No medical records shared in the vault.</p>' : ''}
            
            ${records.map(record => `
                <div class="record-card">
                    <span class="record-type type-${record.type}">${record.type.replace('_', ' ')}</span>
                    <h3 class="record-title">${record.title}</h3>
                    <div class="record-date">Recorded on ${new Date(record.date).toLocaleDateString()}</div>
                    
                    ${record.description ? `<p class="record-detail"><strong>Description:</strong> ${record.description}</p>` : ''}
                    ${record.vaccineName ? `<p class="record-detail"><strong>Vaccine/Med:</strong> ${record.vaccineName}</p>` : ''}
                    ${record.dosage ? `<p class="record-detail"><strong>Dosage:</strong> ${record.dosage}</p>` : ''}
                    ${record.vetName ? `<p class="record-detail"><strong>Vet:</strong> ${record.vetName} at ${record.vetClinic || 'N/A'}</p>` : ''}
                    ${record.treatment ? `<p class="record-detail"><strong>Treatment:</strong> ${record.treatment}</p>` : ''}
                    
                    ${record.attachments && record.attachments.length > 0 ? `
                        <div style="margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
                            ${record.attachments.map((url, i) => `
                                <a href="${url}" target="_blank" class="attachment-link">
                                    📎 Document ${i + 1}
                                </a>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>

        <div style="text-align: center; border-top: 1px solid var(--border); padding-top: 30px; margin-top: 50px;">
            <p style="font-size: 12px; color: var(--text-muted);">
                Generated by <strong>PetVitals Hub</strong> Digital Medical Vault.<br>
                For questions, contact owner at ${pet.userId.email} or ${pet.userId.phone}
            </p>
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
