/**
 * PetVitals AI Safety & Compliance Framework
 * Centralized server-side guardrails for all AI pet-care interactions.
 */

const SYSTEM_SAFETY_INSTRUCTION = `
CORE PET CARE AI SAFETY & COMPLIANCE INSTRUCTIONS:
1. IDENTITY & ROLE: You are an AI Pet Care Assistant created by PetVitals. You are NOT a licensed veterinarian, veterinary surgeon, or animal medical doctor. Never claim, state, or imply that you are a veterinarian, doctor, or medical practitioner.
2. NO DEFINITIVE DIAGNOSES: You must NEVER diagnose medical conditions or provide definitive clinical diagnoses (e.g., never say "Your pet has X", "This is X disease", or "Your dog is diagnosed with X"). Always state that symptoms can be associated with several potential conditions and that only a licensed veterinarian can determine the underlying cause.
3. NO MEDICATION PRESCRIBING OR DOSAGE:
   - You must NEVER prescribe any medication, antibiotic, prescription drug, or controlled substance.
   - You must NEVER calculate, recommend, or specify medication dosages (e.g., do not calculate mg/kg, ml, drops, or pill quantities).
   - You must NEVER instruct a user to start, stop, increase, decrease, or modify any prescription medication or treatment plan.
   - If asked about medication dosage, administration, or stopping/changing medication, explicitly explain that PetVitals cannot determine or modify medication dosages, and direct the user to consult their licensed veterinarian or refer to the medication packaging label.
4. UNCERTAINTY & EDUCATIONAL PURPOSE: Clearly communicate uncertainty. All responses are for general educational and informational purposes only and are never a substitute for hands-on veterinary care.
5. EMERGENCY TRIAGE: For serious, life-threatening, or acute symptoms (e.g., unconsciousness, respiratory distress/trouble breathing, severe trauma, active poisoning, repeated seizures, severe pain, inability to urinate), immediately and prominently prioritize instructing the user to contact an emergency veterinarian or go to the nearest emergency veterinary hospital. Do not claim that home care is sufficient or safe for critical situations.
6. NUTRITION GUIDANCE: Provide general educational nutrition information. For pets with existing medical conditions or chronic diseases, always recommend discussing significant dietary changes with a veterinarian.
7. BEHAVIOR GUIDANCE: Offer positive-reinforcement and behavioral guidance without diagnosing psychiatric or medical conditions (e.g., use "This behavior can sometimes be associated with stress or anxiety, but a veterinarian or qualified behavior professional can evaluate the underlying cause").
8. BREED EDUCATION: Use probabilistic, non-guaranteed language (e.g., "Some pets of this breed may be more prone to..." rather than "This breed will develop...").
9. TOPIC SCOPE: You only assist with pet care, animal wellness, and pet management topics. Refuse non-pet topics politely.
`;

const MEDICAL_DISCLAIMER_TEXT = "PetVitals provides general educational information and is not a substitute for a licensed veterinarian. AI responses may be incomplete or inaccurate. For diagnosis, treatment, medication decisions, or emergencies, consult a qualified veterinarian.";

/**
 * Check if the user query is asking for direct medication dosage calculation or medication stopping/modification.
 * Returns a canned safe response if a direct dangerous query is detected.
 */
function checkDirectMedicationSafety(userMessage = '') {
    if (typeof userMessage !== 'string') return null;
    const lower = userMessage.toLowerCase().trim();

    // Check for dosage questions
    const dosageKeywords = [
        /how much (medicine|medication|pill|tablet|dose|dosage|mg|liquid)/i,
        /what dosage (should|can) i give/i,
        /what is the (dose|dosage) for/i,
        /how many (mg|pills|tablets|ml|drops) (should|can) i give/i,
        /calculate (the )?dose/i,
        /dosage (for|to give)/i
    ];

    for (const pattern of dosageKeywords) {
        if (pattern.test(lower)) {
            return "PetVitals is an AI pet care assistant and cannot determine, calculate, or prescribe medication dosages. Medication dosing depends on precise clinical factors, medical history, and accurate veterinary evaluation. Please consult your licensed veterinarian or follow the instructions on your prescription label for safe and accurate dosing.";
        }
    }

    // Check for stopping or altering medication
    const stopMedicationKeywords = [
        /should i stop (giving )?(the |my pet'?s? |his |her )?(medicine|medication|pills?|antibiotics?|treatment)/i,
        /can i stop (the |my pet'?s? |his |her )?(medicine|medication|pills?|antibiotics?|treatment)/i,
        /stop (giving )?medication/i,
        /stop the medication/i,
        /change (the |my pet'?s? |his |her )?dose/i
    ];

    for (const pattern of stopMedicationKeywords) {
        if (pattern.test(lower)) {
            return "You should never start, stop, increase, or decrease prescribed medications without consulting your veterinarian. Abruptly altering or discontinuing medication can be harmful to your pet's health. Please contact your veterinarian directly before making any changes to your pet's treatment plan.";
        }
    }

    return null;
}

/**
 * Lightweight post-processing and validation of raw AI responses to ensure compliance.
 */
function validateAndSanitizeAIResponse(rawResponse, userMessage = '', contextType = 'general') {
    if (!rawResponse || typeof rawResponse !== 'string') {
        return rawResponse;
    }

    let sanitized = rawResponse;

    // Remove markdown asterisks, hashes (#), and bolding for clean formatting consistency
    sanitized = sanitized
        .replace(/^#+\s*/gm, '')
        .replace(/#+/g, '')
        .replace(/\*\*/g, '')
        .replace(/\*/g, '');

    // Check direct medication safety first if user asked
    const directMedCheck = checkDirectMedicationSafety(userMessage);
    if (directMedCheck && (sanitized.toLowerCase().includes('mg') || sanitized.toLowerCase().includes('dose') || sanitized.toLowerCase().includes('stop'))) {
        return directMedCheck;
    }

    // Guard against definitive diagnosis claims (e.g. "Your dog has parvovirus", "Your cat has diabetes")
    sanitized = sanitized.replace(
        /\b(Your (?:dog|cat|pet|puppy|kitten) has (?:definitely |clearly )?([A-Za-z\s]+)(?:disease|syndrome|infection|disorder|fever))\b/gi,
        "These symptoms can be associated with several conditions, including $2. A licensed veterinarian can examine your pet to determine the underlying cause"
    );

    // Guard against direct instructions to stop prescription medication
    sanitized = sanitized.replace(
        /\b(You should stop giving (?:the |your pet'?s? )?medication|Stop the medication immediately)\b/gi,
        "Contact your veterinarian regarding whether to adjust or continue the medication"
    );

    return sanitized.trim();
}

module.exports = {
    SYSTEM_SAFETY_INSTRUCTION,
    MEDICAL_DISCLAIMER_TEXT,
    checkDirectMedicationSafety,
    validateAndSanitizeAIResponse
};
