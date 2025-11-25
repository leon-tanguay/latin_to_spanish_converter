// Utility functions
function isVowel(char) {
    return 'aeiouAEIOU'.includes(char);
}

function spanishSentenceCase(text) {
    if (!text || typeof text !== "string") return text;
    text = text.trim();
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

// ===== FORMATTING HELPER FUNCTIONS =====
// These strip and restore special characters like quotes, brackets, underlines, etc.

function stripFormatting(input) {
    const formatting = {
        hasQuotes: input.includes('"'),
        hasUnderline: input.includes('<u>'),
        underlinePosition: -1,
        hasBrackets: input.startsWith('[') && input.endsWith(']'),
        hasSlashes: input.startsWith('/') && input.endsWith('/'),
        stressPositions: [] // Track all apostrophe positions
    };
    
    // Find stress markers (apostrophes) before removing other formatting
    let tempClean = input.replace(/["[\]/]/g, ''); // Remove quotes, brackets, slashes but keep apostrophes
    tempClean = tempClean.replace(/<\/?u>/g, ''); // Remove underline tags
    
    // Find apostrophe positions in syllables
    const syllables = tempClean.split(/[.\s]+/);
    syllables.forEach((syl, idx) => {
        if (syl.startsWith("'")) {
            formatting.stressPositions.push(idx);
        }
    });
    
    // Find underline position
    if (formatting.hasUnderline) {
        const parts = input.replace(/['"[\]/]/g, '').split(' ');
        parts.forEach((part, idx) => {
            if (part.includes('<u>')) {
                formatting.underlinePosition = idx;
            }
        });
    }
    
    // Remove all formatting including apostrophes now
    let clean = input.replace(/['"]/g, ''); // Remove quotes
    clean = clean.replace(/<\/?u>/g, ''); // Remove underline tags
    clean = clean.replace(/^\[|\]$/g, ''); // Remove brackets
    clean = clean.replace(/^\/|\/$/g, ''); // Remove slashes
    clean = clean.replace(/'/g, ''); // Remove apostrophes
    clean = clean.trim();
    
    return { clean, formatting };
}

function restoreFormatting(text, formatting) {
    let result = text;
    
    // Restore stress markers (apostrophes) in IPA notation
    if (formatting.stressPositions.length > 0) {
        const delimiter = (formatting.hasBrackets || formatting.hasSlashes) ? '.' : ' ';
        const syllables = result.split(new RegExp(`[.\\s]+`)); // Split by both . and space
        let syllableIndex = 0;
        
        const newSyllables = [];
        for (let i = 0; i < syllables.length; i++) {
            if (syllables[i]) {
                if (formatting.stressPositions.includes(syllableIndex)) {
                    newSyllables.push("'" + syllables[i]);
                } else {
                    newSyllables.push(syllables[i]);
                }
                syllableIndex++;
            }
        }
        
        result = newSyllables.join(delimiter);
    }
    
    // Restore underline if it was present
    if (formatting.hasUnderline && formatting.underlinePosition >= 0) {
        const parts = result.split(' ');
        if (parts[formatting.underlinePosition]) {
            parts[formatting.underlinePosition] = '<u>' + parts[formatting.underlinePosition] + '</u>';
            result = parts.join(' ');
        }
    }
    
    // Restore brackets
    if (formatting.hasBrackets) {
        result = '[' + result + ']';
    }
    
    // Restore slashes
    if (formatting.hasSlashes) {
        result = '/' + result + '/';
    }
    
    // Restore quotes
    if (formatting.hasQuotes) {
        result = '"' + result + '"';
    }
    
    return result;
}


// ===== END HELPER FUNCTIONS =====

// ===== STEP FUNCTIONS =====
// Add your step functions here. Each returns { stepNumber, result, description } or null

function step0a(input) {
    // Split into syllables following Latin rules with diphthong recognition
    const syllables = [];
    let currentSyllable = '';
    const chars = input.split('');
    
    // Latin diphthongs - only these 3
    function isDiphthong(char1, char2) {
        if (!char1 || !char2) return false;
        const combo = (char1 + char2).toLowerCase();
        return combo === 'ae' || combo === 'oe' || combo === 'au';
    }
    
    let i = 0;
    while (i < chars.length) {
        const char = chars[i];
        const nextChar = chars[i + 1];
        const nextNextChar = chars[i + 2];
        
        // Handle consonants at start of syllable (force uppercase)
        if (!isVowel(char)) {
            currentSyllable += char.toUpperCase();
            i++;
            continue;
        }
        
        // Handle diphthong (force uppercase)
        if (isDiphthong(char, nextChar)) {
            currentSyllable += char.toUpperCase() + nextChar.toUpperCase();
            i += 2;
            
            // Add any trailing consonants before syllable break (force uppercase)
            while (i < chars.length && !isVowel(chars[i])) {
                // Check if next char is a vowel - if so, stop before this consonant
                if (i + 1 < chars.length && isVowel(chars[i + 1])) {
                    break;
                }
                currentSyllable += chars[i].toUpperCase();
                i++;
            }
            
            syllables.push(currentSyllable);
            currentSyllable = '';
            continue;
        }
        
        // Handle regular vowel (keep original capitalization)
        if (isVowel(char)) {
            currentSyllable += char;
            i++;
            
            // Add any trailing consonants before syllable break (force uppercase)
            while (i < chars.length && !isVowel(chars[i])) {
                // Check if next char is a vowel - if so, stop before this consonant
                if (i + 1 < chars.length && isVowel(chars[i + 1])) {
                    break;
                }
                currentSyllable += chars[i].toUpperCase();
                i++;
            }
            
            syllables.push(currentSyllable);
            currentSyllable = '';
            continue;
        }
        
        i++;
    }
    
    // Add any remaining characters to last syllable
    if (currentSyllable) {
        if (syllables.length > 0) {
            syllables[syllables.length - 1] += currentSyllable;
        } else {
            syllables.push(currentSyllable);
        }
    }
    
    const result = '"' + syllables.join(' ') + '"';
    
    // Only show this step if word has multiple syllables
    if (syllables.length <= 1) return null;
    
    return {
        stepNumber: '0a',
        result: result,
        description: 'Dividir en sílabas según reglas latinas (diptongos: ae, oe, au)'
    };
}

function step0b(input) {
    // Find the sílaba tónica (stressed syllable)
    
    // Remove quotes if present
    let word = input.replace(/["']/g, '');
    
    // Split into syllables
    const syllables = word.split(' ');
    
    // If only one syllable, mark it as tonic
    if (syllables.length === 1) {
        return {
            stepNumber: '0b',
            result: '"' + `<u>${syllables[0]}</u>` + '"',
            description: 'Identificar sílaba tónica (única sílaba)'
        };
    }
    
    // If two syllables, always the first one
    if (syllables.length === 2) {
        return {
            stepNumber: '0b',
            result: '"' + `<u>${syllables[0]}</u> ${syllables[1]}` + '"',
            description: 'Identificar sílaba tónica (primera de dos sílabas)'
        };
    }
    
    // Function to check if syllable is pesada (heavy)
    function isPesada(syllable) {
        // Has diphthong (AE, OE, AU in uppercase)
        if (syllable.includes('AE') || syllable.includes('OE') || syllable.includes('AU')) {
            return true;
        }
        
        // Has long vowel (capital vowel: A, E, I, O, U)
        if (/[AEIOU]/.test(syllable)) {
            return true;
        }
        
        // Ends with consonant
        const lastChar = syllable[syllable.length - 1];
        if (lastChar && !isVowel(lastChar)) {
            return true;
        }
        
        return false;
    }
    
    // Classify each syllable
    const weights = syllables.map(syl => isPesada(syl) ? 'pesada' : 'ligera');
    
    // Find tonic syllable (3+ syllables)
    let tonicIndex = -1;
    
    // Check if second-to-last (penultimate) is pesada
    const penultimateIndex = syllables.length - 2;
    if (isPesada(syllables[penultimateIndex])) {
        tonicIndex = penultimateIndex;
    } else {
        // Otherwise, always third-to-last (antepenultimate)
        tonicIndex = syllables.length - 3;
    }
    
    // Mark the tonic syllable with underline
    const result = syllables.map((syl, idx) => {
        if (idx === tonicIndex) {
            return `<u>${syl}</u>`;
        }
        return syl;
    }).join(' ');
    
    return {
        stepNumber: '0b',
        result: '"' + result + '"',
        description: `Identificar sílaba tónica (${weights.map((w, i) => `${syllables[i]}=${w}`).join(', ')})`
    };
}

function step0c(input) {
    // Convert to International Phonetic Alphabet (IPA)
    
    // Remove quotes but keep track of underlined syllable
    let word = input.replace(/['"]/g, '');
    
    // Split into syllables and track which is underlined (tonic)
    const syllables = word.split(' ');
    let tonicIndex = -1;
    
    // Find which syllable is underlined
    syllables.forEach((syl, idx) => {
        if (syl.includes('<u>')) {
            tonicIndex = idx;
        }
    });
    
    // Remove underline tags from syllables
    const cleanSyllables = syllables.map(syl => syl.replace(/<\/?u>/g, ''));
    
    let ipaSyllables = [];
    
    for (let syllable of cleanSyllables) {
        let ipa = '';
        
        for (let i = 0; i < syllable.length; i++) {
            const char = syllable[i];
            const nextChar = syllable[i + 1];
            const lowerChar = char.toLowerCase();
            
            // Handle diphthongs first
            if (lowerChar === 'a' && nextChar && nextChar.toLowerCase() === 'e') {
                ipa += 'aj';
                i++; // skip next char
                continue;
            }
            if (lowerChar === 'o' && nextChar && nextChar.toLowerCase() === 'e') {
                ipa += 'oj';
                i++; // skip next char
                continue;
            }
            if (lowerChar === 'a' && nextChar && nextChar.toLowerCase() === 'u') {
                ipa += 'aw';
                i++; // skip next char
                continue;
            }
            
            // Vowels - long vs short based on capitalization
            if (lowerChar === 'a') {
                ipa += char === 'A' ? 'a:' : 'a';
            } else if (lowerChar === 'e') {
                ipa += char === 'E' ? 'e:' : 'e';
            } else if (lowerChar === 'i') {
                ipa += char === 'I' ? 'i:' : 'i';
            } else if (lowerChar === 'o') {
                ipa += char === 'O' ? 'o:' : 'o';
            } else if (lowerChar === 'u') {
                ipa += char === 'U' ? 'u:' : 'u';
            }
            // Consonants
            else if (lowerChar === 'c') {
                ipa += 'k';
            } else if (lowerChar === 'v') {
                ipa += 'w';
            } else if (lowerChar === 'j') {
                ipa += 'j';
            } else if (lowerChar === 'q') {
                ipa += 'kw';
            } else if (lowerChar === 'x') {
                ipa += 'ks';
            } else if (lowerChar === 'g' && nextChar && (nextChar.toLowerCase() === 'n')) {
                ipa += 'ŋ';
            } else {
                // Default: keep consonant as is (most Latin consonants match IPA)
                ipa += lowerChar;
            }
        }
        
        ipaSyllables.push(ipa);
    }
    
    // Join syllables with periods and mark tonic with apostrophe
    const ipaResult = ipaSyllables.map((syl, idx) => {
        if (idx === tonicIndex) {
            return "'" + syl;
        }
        return syl;
    }).join('.');
    
    const result = '/' + ipaResult + '/';
    
    return {
        stepNumber: '0c',
        result: result,
        description: 'Convertir a pronunciación fonética internacional (IPA)'
    };
}

function step1(input) {
    // Drop any 'm' at the end of words
    
    const { clean, formatting } = stripFormatting(input);
    
    // Check if word ends with 'm'
    if (!clean.endsWith('m')) {
        return null; // No change needed
    }
    
    // Remove the final 'm'
    const result = clean.slice(0, -1);
    
    return {
        stepNumber: '1',
        result: restoreFormatting(result, formatting),
        description: 'PROCESO FONOLÓGICO 1: (ELISIÓN) PÉRDIDA DE “M” AL FINAL DE PALABRA'
    };
}

function step2(input) {
    // Pérdida de /h/ al principio de palabra
    
    const { clean, formatting } = stripFormatting(input);
    
    // Check if word starts with 'h'
    if (!clean.toLowerCase().startsWith('h')) {
        return null; // No change needed
    }
    
    // Remove the initial 'h'
    const result = clean.slice(1);
    
    return {
        stepNumber: '2',
        result: restoreFormatting(result, formatting),
        description: 'Pérdida de "/h/" al principio de palabra'
    };
}

function step3_i(input) {
    // Monoptongación (eliminación de diptongos)
    
    const { clean, formatting } = stripFormatting(input);
    
    let result = clean;
    
    // Eliminate diphthongs
    const original = result;
    result = result.replace(/aj/g, 'e')
                   .replace(/aw/g, 'o')
                   .replace(/oj/g, 'e');
    
    if (result === original) return null;
    
    return {
        stepNumber: '3',
        result: restoreFormatting(result, formatting),
        description: 'Monoptongación (ae→e, au→o, oe→e)'
    };
}

function step3_ii(input) {
    // Confusión vocálica en sílaba tónica: apertura de e→ɛ y o→ɔ
    
    const { clean, formatting } = stripFormatting(input);
    
    let result = clean;
    let changed = false;
    
    const syllables = clean.split(/[\s.]+/);
    
    for (let i = 0; i < syllables.length; i++) {
        let syl = syllables[i];
        
        // Check if this is the tonic syllable
        if (formatting.stressPositions && formatting.stressPositions.includes(i)) {
            const original = syl;
            
            // Open e to ɛ in tonic syllable
            syl = syl.replace(/e(?!:)/g, 'ɛ');

            // Open o to ɔ in tonic syllable
            syl = syl.replace(/o(?!:)/g, 'ɔ');

            // Apply vowel confusion rules in tonic syllable
            // Short vowels merge and open: ĭ → e, ē → e
            syl = syl.replace(/i(?!:)/g, 'e');   // Short i → e
            syl = syl.replace(/i:/g, 'i'); // Keep long i as i
            syl = syl.replace(/e:/g, 'e');  // Long e → e
            syl = syl.replace(/a:/g, 'a');  // Long a → a
            // Short vowels merge and open: ŭ → o, ō → o
            
            syl = syl.replace(/u(?!:)/g, 'o');   // Short u → o
            syl = syl.replace(/u:/g, 'u'); // Keep long u as u
            syl = syl.replace(/o:/g, 'o');  // Long o → o   
            
            if (syl !== original) {
                changed = true;
            }
            
            syllables[i] = syl;
        }
    }
    
    if (!changed) return null;
    
    result = syllables.join(formatting.hasBrackets || formatting.hasSlashes ? '.' : ' ');
    
    return {
        stepNumber: '3',
        result: restoreFormatting(result, formatting),
        description: 'Confusión vocálica en sílaba tónica (e→ɛ, o→ɔ)'
    };
}

function step3_iii(input) {
    // Confusión vocálica en sílabas átonas
    
    const { clean, formatting } = stripFormatting(input);
    
    let result = clean;
    let changed = false;
    
    const syllables = clean.split(/[\s.]+/);
    
    for (let i = 0; i < syllables.length; i++) {
        let syl = syllables[i];
        
        // Skip tonic syllable and final syllable
        if (formatting.stressPositions && formatting.stressPositions.includes(i)) {
            continue;
        }
        
        const original = syl;

        // Apply vowel confusion rules in nontonic syllable
        // Short vowels merge and open: ĭ → e, ē → e
        syl = syl.replace(/i(?!:)/g, 'e');   // Short i → e
        syl = syl.replace(/e:/g, 'e');  // short and long e → e

        syl = syl.replace(/a:/g, 'a'); // short and long a → a

        syl = syl.replace(/i:/g, 'i'); // Keep long i as i

        syl = syl.replace(/e:/g, 'e');  // Long e → e
                
        syl = syl.replace(/u(?!:)/g, 'o');   // Short u → o
        syl = syl.replace(/u:/g, 'u'); // Keep long u as u
        syl = syl.replace(/o:/g, 'o');  // Long o → o   
        
        if (syl !== original) {
            changed = true;
        }
        
        syllables[i] = syl;
    }
    
    if (!changed) return null;
    
    result = syllables.join(formatting.hasBrackets || formatting.hasSlashes ? '.' : ' ');
    
    return {
        stepNumber: '3',
        result: restoreFormatting(result, formatting),
        description: 'Confusión vocálica en sílabas átonas'
    };
}

function step3_iv(input) {
    // Confusión vocálica especial en sílaba final
    
    const { clean, formatting } = stripFormatting(input);
    
    const syllables = clean.split(/[\s.]+/);
    const lastIndex = syllables.length - 1;
    
    if (lastIndex < 0) return null;
    
    let lastSyl = syllables[lastIndex];
    const original = lastSyl;
    
    // Special rules for final syllable
    lastSyl = lastSyl.replace(/i/g, 'e'); // Final i → e
    lastSyl = lastSyl.replace(/u/g, 'o'); // Final u → o
    
    if (lastSyl === original) return null;
    
    syllables[lastIndex] = lastSyl;
    result = syllables.join(formatting.hasBrackets || formatting.hasSlashes ? '.' : ' ');
    
    return {
        stepNumber: '3',
        result: restoreFormatting(result, formatting),
        description: 'Confusión vocálica especial en sílaba final (i→e, u→o)'
    };
}

function step3_v(input) {
    // Desaparición de sílabas átonas intertónicas - Primera pasada: marcar con ∅
    
    const { clean, formatting } = stripFormatting(input);
    
    let syllables = clean.split(/[\s.]+/);
    
    if (syllables.length < 3) return null; // Need at least 3 syllables
    
    const tonicIndex = formatting.stressPositions && formatting.stressPositions.length > 0 
        ? formatting.stressPositions[0] 
        : Math.max(0, syllables.length - 2);
    
    let changed = false;
    
    for (let i = 0; i < syllables.length; i++) {
        // Mark vowels in intertonic syllables (between first and tonic)
        if (i > 0 && i < tonicIndex) {
            const original = syllables[i];
            // Replace vowels with ∅
            syllables[i] = syllables[i].replace(/[aeiouɛɔāēīōū:]/g, '∅');
            if (syllables[i] !== original) {
                changed = true;
            }
        }
    }
    
    if (!changed) return null;
    
    result = syllables.join(formatting.hasBrackets || formatting.hasSlashes ? '.' : ' ');
    
    return {
        stepNumber: '3',
        result: restoreFormatting(result, formatting),
        description: 'Desaparición de sílabas átonas intertónicas: marcar vocales con ∅'
    };
}

function step3_vi(input) {
    // Desaparición de sílabas átonas intertónicas - Segunda pasada: eliminar y unir consonantes
    
    const { clean, formatting } = stripFormatting(input);
    
    let syllables = clean.split(/[\s.]+/);
    
    // Check if there are any ∅ symbols to remove
    if (!clean.includes('∅')) return null;
    
    const newSyllables = [];
    const newStressPositions = [];
    let consonantsToAdd = '';
    
    for (let i = 0; i < syllables.length; i++) {
        if (syllables[i].includes('∅')) {
            // Extract consonants from this syllable (remove ∅)
            consonantsToAdd += syllables[i].replace(/∅/g, '');
        } else {
            // Add accumulated consonants to the beginning of this syllable
            const newSyllable = consonantsToAdd + syllables[i];
            newSyllables.push(newSyllable);
            
            // Check if the original syllable was tonic
            if (formatting.stressPositions && formatting.stressPositions.includes(i)) {
                // The stress marker should go before the consonants we just added
                // Update the stress position to the new syllable index
                newStressPositions.push(newSyllables.length - 1);
            }
            
            consonantsToAdd = '';
        }
    }
    
    // Update formatting to reflect new stress positions
    formatting.stressPositions = newStressPositions;
    
    const result = newSyllables.join(formatting.hasBrackets || formatting.hasSlashes ? '.' : ' ');
    
    return {
        stepNumber: '3',
        result: restoreFormatting(result, formatting),
        description: 'Desaparición de sílabas átonas intertónicas: eliminar ∅ y unir consonantes'
    };
}

function step4(input) {
    // DESVELARIZACIÓN de /w/ (La V latina)
    
    const { clean, formatting } = stripFormatting(input);
    
    // Check if word starts with 'h'
    if (!clean.includes("w")) {
        return null; // No change needed
    }
    
    // Remove the initial 'h'
    const result = clean.replace(/w/g, 'β');
    
    return {
        stepNumber: '4',
        result: restoreFormatting(result, formatting),
        description: 'DESVELARIZACIÓN de /w/ (La V latina)'
    };
}

// ===== ADD MORE STEP FUNCTIONS ABOVE THIS LINE =====

// Array of all step functions - ADD YOUR FUNCTIONS TO THIS ARRAY
const stepFunctions = [
    step0a,
    step0b,
    step0c,
    step1,
    step2,
    step3_i,
    step3_ii,
    step3_iii,
    step3_iv,
    step3_v,
    step3_vi,
    step4
    // Add more step functions here as you create them
];

function processWord() {
    const input = document.getElementById('wordInput');
    const trimmed = input.value.trim();
    
    if (!trimmed) {
        alert('Por favor ingrese una palabra.');
        return;
    }
    
    if (trimmed.includes(' ')) {
        alert('Por favor ingrese solo una palabra (sin espacios).');
        return;
    }

    const hasVowels = trimmed.split('').some(char => isVowel(char));
    if (!hasVowels) {
        alert('La palabra debe contener al menos una vocal.');
        return;
    }

    const steps = [];
    let currentWord = trimmed;

    // Start with original word
    steps.push({
        stepNumber: 'Inicio',
        result: currentWord,
        description: 'Palabra original (mayúsculas en vocales = largas, minúsculas = cortas)'
    });

    // Process through each step function
    for (const stepFn of stepFunctions) {
        const stepResult = stepFn(currentWord);
        
        if (stepResult !== null) {
            steps.push(stepResult);
            currentWord = stepResult.result;
        }
    }

    displaySteps(steps);
    document.getElementById('clearBtn').classList.remove('hidden');
}

function displaySteps(steps) {
    const container = document.getElementById('stepsContainer');
    const emptyState = document.getElementById('emptyState');
    
    container.innerHTML = '';
    
    steps.forEach(step => {
        
        const stepCard = document.createElement('div');
        stepCard.className = 'step-card';
        
        // Determine color based on step number
        let stepColor;
        const stepNum = step.stepNumber.toString();
        
        if (stepNum === 'Inicio' || stepNum.startsWith('0')) {
            stepColor = 'var(--color-step-0)'; // Green for step 0
        } else if (stepNum > '22') {
            stepColor = 'var(--color-step-modern)'; // Purple for step 20+
        } else {
            stepColor = 'var(--color-step-medieval)'; // Orange for regular steps
        }
        
        stepCard.innerHTML = `
            <div class="step-content">
                <div class="step-number" style="background: ${stepColor};">${step.stepNumber}</div>
                <div class="step-details">
                    <div class="step-result">
                        <p>${step.result}</p>
                    </div>
                    <p class="step-description">${spanishSentenceCase(step.description)}</p>
                </div>
            </div>
        `;
        container.appendChild(stepCard);
    });

    container.classList.remove('hidden');
    emptyState.classList.add('hidden');
}

function handleClear() {
    document.getElementById('wordInput').value = '';
    document.getElementById('stepsContainer').classList.add('hidden');
    document.getElementById('emptyState').classList.remove('hidden');
    document.getElementById('clearBtn').classList.add('hidden');
}

// Handle Enter key
document.getElementById('wordInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        processWord();
    }
});

// Prevent spaces in input
document.getElementById('wordInput').addEventListener('input', function(e) {
    if (e.target.value.includes(' ') || e.target.value.includes('\t') || e.target.value.includes('\n')) {
        e.target.value = e.target.value.replace(/[\s\t\n]/g, '');
    }
});