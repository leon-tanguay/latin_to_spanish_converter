// Utility functions
function isVowel(char) {
    return 'aeiouɔɛAEIOU'.includes(char);
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

function restoreFormatting(text, formatting, options = {}) {
    let result = text;

    // Restore stress markers (apostrophes) in IPA notation
    if (formatting.stressPositions && formatting.stressPositions.length > 0) {
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

    // Decide whether to render as [...] or /.../
    // options.forceSquareBrackets: if true, convert any original slashes into square brackets
    const wantSquare = !!options.forceSquareBrackets;

    // Restore brackets (explicit original brackets)
    if (formatting.hasBrackets) {
        result = '[' + result + ']';
    } else if (formatting.hasSlashes) {
        // If original had slashes, either keep slashes or convert to brackets per option
        if (wantSquare) {
            result = '[' + result + ']';
        } else {
            result = '/' + result + '/';
        }
    }

    // Restore quotes
    if (formatting.hasQuotes) {
        result = '"' + result + '"';
    }

    return result;
}

// ---------- Shared helpers for sincopa (common code for step 8 and 18) ----------

/**
 * markIntertonicSyllables(clean, formatting)
 * - Marks vowels in intertonic (medial) syllables with '∅'.
 * - Returns null if no change required, otherwise returns the new "clean" string
 *   (with vowels replaced by ∅) so it can be fed to the second pass.
 *
 * Behavior mirrors your previous step8_i: if tonic is first syllable, mark
 * medial syllables (1..last-1). Otherwise mark (1..tonicIndex-1).
 */
function markIntertonicSyllables(clean, formatting) {
    const syllables = clean.split(/[\s.]+/);
    if (syllables.length < 3) return null;

    const tonicIndex = (formatting.stressPositions && formatting.stressPositions.length > 0)
        ? formatting.stressPositions[0]
        : Math.max(0, syllables.length - 2);

    let changed = false;

    if (tonicIndex === 0) {
        for (let i = 1; i < syllables.length - 1; i++) {
            const original = syllables[i];
            syllables[i] = syllables[i].replace(/[aeiouɛɔāēīōū:]/g, '∅');
            if (syllables[i] !== original) changed = true;
        }
    } else {
        for (let i = 1; i < tonicIndex; i++) {
            const original = syllables[i];
            syllables[i] = syllables[i].replace(/[aeiouɛɔāēīōū:]/g, '∅');
            if (syllables[i] !== original) changed = true;
        }
    }

    if (!changed) return null;
    return syllables.join(formatting.hasBrackets || formatting.hasSlashes ? '.' : ' ');
}

/**
 * applyIntertonicRemoval(cleanWithDots, formatting)
 * - Takes a string already containing '∅' markers and removes them, redistributing
 *   consonants according to your adjusted rule:
 *     - accumulate consonants from ∅ syllables into consonantsToAdd
 *     - if the target syllable begins with a consonant, append consonantsToAdd
 *       to the previous new syllable (coda)
 *     - otherwise, prepend consonantsToAdd to the target syllable (onset)
 * - Returns null if no ∅ present (no-op), otherwise returns the new cleaned string
 *   and updates formatting.stressPositions to the new indices.
 */
function applyIntertonicRemoval(cleanWithDots, formatting) {
    if (!cleanWithDots.includes('∅')) return null;

    let syllables = cleanWithDots.split(/[\s.]+/);
    const newSyllables = [];
    const newStressPositions = [];
    let consonantsToAdd = '';

    for (let i = 0; i < syllables.length; i++) {
        if (syllables[i].includes('∅')) {
            // remove ∅ and collect remaining consonants
            consonantsToAdd += syllables[i].replace(/∅/g, '');
        } else {
            let targetSyl = syllables[i];

            if (consonantsToAdd) {
                const startsWithVowel = /^[aeiouɔɛ]/i.test(targetSyl);

                if (!startsWithVowel && newSyllables.length > 0) {
                    // attach to coda of previous syllable
                    newSyllables[newSyllables.length - 1] =
                        newSyllables[newSyllables.length - 1] + consonantsToAdd;
                } else {
                    // attach to onset of target syllable
                    targetSyl = consonantsToAdd + targetSyl;
                }
            }

            newSyllables.push(targetSyl);

            // map tonic index if present
            if (formatting.stressPositions && formatting.stressPositions.includes(i)) {
                newStressPositions.push(newSyllables.length - 1);
            }

            consonantsToAdd = '';
        }
    }

    // leftover consonants: append to last syllable
    if (consonantsToAdd) {
        if (newSyllables.length > 0) {
            newSyllables[newSyllables.length - 1] += consonantsToAdd;
        } else {
            newSyllables.push(consonantsToAdd);
        }
    }

    // Update formatting object (in-place) with new stress positions
    formatting.stressPositions = newStressPositions;

    return newSyllables.join(formatting.hasBrackets || formatting.hasSlashes ? '.' : ' ');
}
// ===== END HELPER FUNCTIONS =====

// ===== STEP FUNCTIONS =====
// Add your step functions here. Each returns { stepNumber, result, description } or null

function step0_i(input) {
    // Descomposición: X → KS, CH → K

    const original = input;

    let result = input
        // Handle x → ks
        .replace(/x/gi, match => (match === 'X' ? 'KS' : 'ks'))
        // Handle ch → k (preserve capitalization)
        .replace(/ch/gi, match => (match === 'CH' ? 'K' : 'k'));

    if (result === original) return null;

    return {
        stepNumber: 'Latin',
        result: result,
        description: 'Pronunciación: X = KS, CH = K'
    };
}

function step0_ii(input) {
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
        stepNumber: 'Inicio',
        result: result,
        description: 'Dividir en sílabas según reglas latinas (diptongos: ae, oe, au)'
    };
}

// NOTE: I am assuming the 'isVowel' helper function is defined elsewhere and is accessible.

function step0_iii_weights(input) {
    // We only run this if the word has 3 or more syllables, as Latin stress rules only apply then.
    // Assuming the input is already syllable-separated by spaces.
    const { clean, formatting } = stripFormatting(input);
    let word = clean;
    
    // Split into syllables
    const syllables = word.split(' ');
    
    // Only proceed with weight analysis for 3+ syllables
    if (syllables.length < 3) return null;

    let changed = false;
    
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
    
    // Classify and mark each syllable
    const markedSyllables = syllables.map(syl => {
        if (isPesada(syl)) {
            changed = true;
            // Italicize pesada syllables
            return `<b>${syl}</b>`; 
        }
        return syl;
    });
    
    if (!changed) return null;
    
    const result = markedSyllables.join(' ');
    
    return {
        stepNumber: 'Inicio',
        result: restoreFormatting(result, formatting),
        description: 'Identificar el peso de la sílaba: *pesada* (Vocal Larga, Diptongo o Termina en Consonante) o ligera.'
    };
}

// NOTE: This function needs the 'isVowel' helper and the 'isPesada' logic from the previous step.

function step0_iii_tonic(input) {
    // Only proceed if the word has 3 or more syllables (stress was assigned in 0b for 1/2 syllables)
    const { clean, formatting } = stripFormatting(input);
    let word = clean;
    
    // The clean string now may contain asterisks * for pesada syllables
    
    // Split into syllables, removing asterisks before analysis
    const cleanSyllables = word.split(' ').map(syl => syl.replace(/\*/g, ''));
    
    if (cleanSyllables.length < 3) return null;
    
    let tonicIndex = -1;
    let wordType = '';
    
    // Re-create isPesada helper to ensure logic consistency (or rely on the asterisk marker)
    // We'll rely on the asterisk marker being present in the input word for the simplest approach.
    const syllables = word.split(' '); // Keep asterisks for index matching
    
    const penultimateIndex = syllables.length - 2;
    const antepenultimateIndex = syllables.length - 3;
    
    // Check if second-to-last (penultimate) is pesada (Grave)
    // A syllable is pesada if it contains an asterisk in this input format.
    const isPenultimatePesada = syllables[penultimateIndex].includes('*');
    
    if (isPenultimatePesada) {
        tonicIndex = penultimateIndex;
        wordType = 'Grave (Penúltima <b>pesada</b>)';
    } else {
        // Otherwise, always third-to-last (antepenultimate) (Esdrújula)
        tonicIndex = antepenultimateIndex;
        wordType = 'Esdrújula (Penúltima ligera)';
    }

    // Mark the tonic syllable with underline
    const result = syllables.map((syl, idx) => {
        if (idx === tonicIndex) {
            // Underline the entire syllable, including its * markers
            return `<u>${syl}</u>`; 
        }
        return syl;
    }).join(' ');
    
    return {
        stepNumber: 'Inicio',
        result: restoreFormatting(result, formatting),
        description: `Identificar sílaba tónica: ${wordType}. (Ley de la Penúltima Latina)`
    };
}

function step0_iv(input) {
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
    
    // --- FIX 1: Correctly remove all underline and bold tags in one step ---
    const tagRegex = /<\/?(u|b)>/gi;
    
    // Correctly map and assign to cleanSyllables
    const cleanSyllables = syllables.map(syl => syl.replace(tagRegex, ''));
    
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
            else if (lowerChar === 'r') {
                ipa += 'ɾ';
            }
            else if (lowerChar === 'c') {
                ipa += 'k';
            } else if (lowerChar === 'v') {
                ipa += 'w';
            } else if (lowerChar === 'j') {
                ipa += 'j';
            } 
            // --- FIX 2: Correctly handle 'qu' and skip 'u' ---
            else if (lowerChar === 'q' && nextChar && nextChar.toLowerCase() === 'u') {
                ipa += 'kw';
                i++; // skip the 'u' that follows the 'q'
                continue;
            } else if (lowerChar === 'x') {
                ipa += 'ks';
            } else if (lowerChar === 'g' && nextChar && nextChar.toLowerCase() === 'n') {
                // Assuming this is for Latin 'gn' as /ŋ/ (less common, but keeping your original rule)
                ipa += 'ŋ';
            } else {
                // Default: keep consonant as is
                ipa += lowerChar;
            }
        }
        
        ipaSyllables.push(ipa);
    }
    
    // Join syllables with periods and mark tonic with apostrophe
    const ipaResult = ipaSyllables.map((syl, idx) => {
        if (idx === tonicIndex) {
            // Add the stress mark (apostrophe) *before* the stressed syllable's content
            return "'" + syl;
        }
        return syl;
    }).join('.');
    
    const result = '/' + ipaResult + '/';
    
    return {
        stepNumber: 'Inicio', // Changed from '0' to '0iv' for consistency with earlier steps
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

function step5(input) {
    // Pérdida de hiato: /e/ átona a /j/ (yod) - con cambio de acento
    
    const { clean, formatting } = stripFormatting(input);
    
    let text = clean;
    let changed = false;
    
    const original = text;
    
    // Get syllables to track which one has stress
    const syllables = text.split(/[\s.]+/);
    const tonicIndex = formatting.stressPositions && formatting.stressPositions.length > 0 
        ? formatting.stressPositions[0] 
        : -1;
    
    // Pattern: consonant + e/ɛ + (syllable break) + vowel → consonant + j + vowel
    text = text.replace(/([bcdfghjklmnpqrstvwxyzβɣðɸθʃʒʧʤŋɲʎ])([eɛ]ː?)[\s.]([aeiouɛɔ])/gi, '$1j$3');
    
    if (text !== original) {
        changed = true;
        hasYod = true;
        
        // Check if yod formed right before the tonic syllable
        const newSyllables = text.split(/[\s.]+/);
        
        // Find where the yod is now
        let yodSyllableIndex = -1;
        newSyllables.forEach((syl, idx) => {
            if (syl.includes('j') && yodSyllableIndex === -1) {
                yodSyllableIndex = idx;
            }
        });
        
        // If yod is in the syllable RIGHT BEFORE the tonic, shift stress to the yod syllable
        if (tonicIndex >= 0 && yodSyllableIndex === tonicIndex - 1) {
            formatting.stressPositions = [yodSyllableIndex];
        }
    }
    
    if (!changed) return null;
    
    return {
        stepNumber: '5',
        result: restoreFormatting(text, formatting),
        description: 'Pérdida de hiato: /e/ átona a /j/ (yod) - con desplazamiento de acento si el yod está antes de la tónica'
    };
}

// Helper: find vowel targets immediately before any palatal/yod triggers
function findPalatalVowelTargets(clean) {
    // ordered palatals (multi-char first)
    const palatals = ['tʃ', 'ts', 'dz', 'ʦ', 'ʣ', 'tɕ', 'j', 'ʎ', 'ɲ', 'ʃ', 'ʒ', 'dʒ'];
    // split keeping separators so we can map syllables
    const pieces = clean.split(/([.\s]+)/); // e.g. ["ɔ", ".", "ko", ".", "los"]
    // build entries: [{syl, sep}]
    const entries = [];
    for (let i = 0; i < pieces.length; i += 2) {
        entries.push({ syl: pieces[i] || '', sep: pieces[i + 1] || '' });
    }

    const targets = []; // { vowelSyllable, vowelChar }

    // scan each syllable for palatals
    for (let s = 0; s < entries.length; s++) {
        const syl = entries[s].syl;
        if (!syl) continue;

        for (const p of palatals) {
            let idx = syl.indexOf(p);
            while (idx !== -1) {
                // find last vowel in same syllable before idx
                const before = syl.slice(0, idx);
                const vowelMatch = before.match(/[aeiouɔɛ]/g);
                if (vowelMatch && vowelMatch.length > 0) {
                    const lastVowel = vowelMatch[vowelMatch.length - 1];
                    targets.push({
                        palatal: p,
                        palatalSyllable: s,
                        vowelSyllable: s,
                        vowelChar: lastVowel
                    });
                } else {
                    // fallback: look in previous syllable's last vowel
                    if (s - 1 >= 0) {
                        const prevSyl = entries[s - 1].syl;
                        const prevVowelMatch = prevSyl.match(/[aeiouɔɛ]/g);
                        if (prevVowelMatch && prevVowelMatch.length > 0) {
                            const lastVowel = prevVowelMatch[prevVowelMatch.length - 1];
                            targets.push({
                                palatal: p,
                                palatalSyllable: s,
                                vowelSyllable: s - 1,
                                vowelChar: lastVowel
                            });
                        }
                    }
                }
                // search next occurrence in same syllable (if any)
                idx = syl.indexOf(p, idx + 1);
            }
        }
    }

    // deduplicate targets by vowelSyllable+vowelChar (keep first)
    const seen = new Set();
    const unique = [];
    for (const t of targets) {
        const key = `${t.vowelSyllable}:${t.vowelChar}`;
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(t);
        }
    }
    return unique; // array of {vowelSyllable, vowelChar, ...}
}

// Replacement stepI_inflection that targets the vowel BEFORE any detected palatal/yod
function stepI_inflection(input) {
    const yodInflectionCheckbox = document.getElementById('yodInflectionCheckbox');
    
    if (!yodInflectionCheckbox || !yodInflectionCheckbox.checked) return null;
    if (!inflectionAvailable || !hasYod) return null; // only once per word

    const { clean, formatting } = stripFormatting(input);
    const original = clean;

    const targets = findPalatalVowelTargets(clean);
    if (!targets || targets.length === 0) return null;

    // Build pieces so we can edit a specific syllable safely (keep separators)
    const pieces = clean.split(/([.\s]+)/);
    const entries = [];
    for (let i = 0; i < pieces.length; i += 2) {
        entries.push({ syl: pieces[i] || '', sep: pieces[i + 1] || '' });
    }

    // vowel mapping (closure)
    const map = { 'ɔ': 'o', 'ɛ': 'e', 'a': 'e', 'o': 'u', 'e': 'i' };

    let changed = false;
    for (const t of targets) {
        const vs = t.vowelSyllable;
        if (vs < 0 || vs >= entries.length) continue;
        const targetVowel = t.vowelChar;
        if (!targetVowel || !map[targetVowel]) continue;

        // replace ONLY the last occurrence of that vowel in that syllable
        const syl = entries[vs].syl;
        const lastIndex = syl.lastIndexOf(targetVowel);
        if (lastIndex !== -1) {
            entries[vs].syl = syl.slice(0, lastIndex) + map[targetVowel] + syl.slice(lastIndex + 1);
            changed = true;
        }
    }

    if (!changed) return null;

    // reconstruct clean string
    let newClean = '';
    for (let i = 0; i < entries.length; i++) {
        newClean += entries[i].syl + entries[i].sep;
    }

    // finalize: prevent further inflection for this word
    inflectionAvailable = false;
    // Optional: keep hasYod consistent (clear or set)
    hasYod = false;

    return {
        stepNumber: 'I',
        result: restoreFormatting(newClean, formatting),
        description: 'Inflexión vocálica por yod/palatales: cierre de la vocal anterior (una vez)'
    };
}

function step6_i(input) {
    // Africación ante yod: tj → tʃ, kj → dz
    
    const { clean, formatting } = stripFormatting(input);
    
    let result = clean;
    const original = result;
    
    // tj → tʃ
    result = result.replace(/tj/g, 'tʃ');
    
    // kj → dz (also cj since c represents /k/)
    result = result.replace(/[kc]j/gi, 'ʣ');
    
    if (result === original) return null;
    
    hasYod = true;

    return {
        stepNumber: '6',
        result: restoreFormatting(result, formatting),
        description: 'Africación ante yod: tj → tʃ, kj/cj → ʣ'
    };
}

function step6_ii(input) {
    // Evolución de africada: tʃ → ts
    
    const { clean, formatting } = stripFormatting(input);
    
    let result = clean;
    const original = result;
    
    // tʃ → ts
    result = result.replace(/tʃ/g, 'ʦ');
    
    if (result === original) return null;
    hasYod = true;
    return {
        stepNumber: '6',
        result: restoreFormatting(result, formatting),
        description: 'Evolución de africada: tʃ → ʦ (suena como "ç")'
    };
}

function step7_i(input) {
    // Palatalización: /k/ → /tʃ/ ante /e/, /i/, /ɛ/ (tónica) y /e/ (átona)
    
    const { clean, formatting } = stripFormatting(input);
    
    let result = clean;
    const original = result;
    
    // k/c before front vowels e, i, ɛ → tʃ
    // This includes both tonic and atonic positions
    result = result.replace(/[kc]([eiɛ])/gi, 'tʃ$1');
    
    if (result === original) return null;
    hasYod = true;
    return {
        stepNumber: '7',
        result: restoreFormatting(result, formatting),
        description: 'Palatalización: /k/ → /tʃ/ ante /e/, /i/, /ɛ/ en sílaba tónica y /e/ átona'
    };
}

function step7_ii(input) {
    // Evolución de africada: /tʃ/ → /ts/
    
    const { clean, formatting } = stripFormatting(input);
    
    let result = clean;
    const original = result;
    
    // tʃ → ts
    result = result.replace(/tʃ/g, 'ts');
    
    if (result === original) return null;
    hasYod = true;
    return {
        stepNumber: '7',
        result: restoreFormatting(result, formatting),
        description: 'Evolución de africada: /tʃ/ → /ts/ (suena como "ç")'
    };
}

function step8_i(input) {
    const segundaSincopaCheckbox = document.getElementById('segundaSincopaCheckbox');
    // If the checkbox exists and is CHECKED, skip step 8 passes here.
    if (segundaSincopaCheckbox && segundaSincopaCheckbox.checked) return null;

    const { clean, formatting } = stripFormatting(input);
    const marked = markIntertonicSyllables(clean, formatting);
    if (!marked) return null;

    return {
        stepNumber: '8',
        result: restoreFormatting(marked, formatting),
        description: 'Desaparición (síncopa) de sílabas átonas intertónicas: marcar vocales con ∅'
    };
}

function step8_ii(input) {
    const segundaSincopaCheckbox = document.getElementById('segundaSincopaCheckbox');
    if (segundaSincopaCheckbox && segundaSincopaCheckbox.checked) return null;

    const { clean, formatting } = stripFormatting(input);
    const applied = applyIntertonicRemoval(clean, formatting);
    if (!applied) return null;

    return {
        stepNumber: '8',
        result: restoreFormatting(applied, formatting),
        description: 'Desaparición (síncopa) de sílabas átonas intertónicas: eliminar ∅ y unir consonantes (regla de distribución de consonantes ajustada)'
    };
}

function step9_i(input) {
    // Palatalización de grupos velares (primera fase): kl→jl, ks→js (intervocálico), kt→jt
    
    const { clean, formatting } = stripFormatting(input);
    
    let result = clean;
    const original = result;
    
    // Remove syllable breaks temporarily to catch cross-syllable patterns
    const noBreaks = result.replace(/[\s.]/g, '');
    let modified = noBreaks;
    
    // kl → jl
    modified = modified.replace(/kl/gi, 'jl');
    
    // ks → js (only intervocalic - between vowels)
    modified = modified.replace(/([aeiouɛɔ])ks([aeiouɛɔ])/gi, '$1js$2');
    
    // kt → jt
    modified = modified.replace(/kt/gi, 'jt');
    
    if (modified === noBreaks) return null;
    
    hasYod = true;

    // Re-apply syllable breaks (keep same structure)
    let finalResult = '';
    let modIndex = 0;
    
    for (let i = 0; i < result.length; i++) {
        if (result[i].match(/[\s.]/)) {
            finalResult += result[i];
        } else {
            finalResult += modified[modIndex];
            modIndex++;
        }
    }
    
    return {
        stepNumber: '9',
        result: restoreFormatting(finalResult, formatting),
        description: 'Palatalización de grupos velares (i): kl→jl, ks→js (intervocálico), kt→jt'
    };
}

function step9_ii(input) {
    // Palatalización de grupos velares (segunda fase): jl→ʎ, js→ʃ, jt→ʧ
    
    const { clean, formatting } = stripFormatting(input);
    
    let result = clean;
    const original = result;
    
    // jl → ʎ (can cross syllable boundary, preserve the break before the result)
    result = result.replace(/j([\s.])l/g, '$1ʎ');
    result = result.replace(/jl/g, 'ʎ'); // Without break
    
    // js → ʃ (suena como "sh", can cross syllable boundary, preserve the break before the result)
    result = result.replace(/j([\s.])s/g, '$1ʃ');
    result = result.replace(/js/g, 'ʃ'); // Without break
    
    // jt → ʧ (suena como "ch", can cross syllable boundary, preserve the break before the result)
    result = result.replace(/j([\s.])t/g, '$1ʧ');
    result = result.replace(/jt/g, 'ʧ'); // Without break
    
    if (result === original) return null;
    hasYod = true;

    return {
        stepNumber: '9',
        result: restoreFormatting(result, formatting),
        description: 'Palatalización de grupos velares (ii): jl→ʎ, js→ʃ (suena como "sh"), jt→ʧ (suena como "ch")'
    };
}

function step9_iii(input) {
    // Palatalización directa: gn→ɲ, gl→ʎ
    
    const { clean, formatting } = stripFormatting(input);
    
    let result = clean;
    const original = result;
    
    // gn → ɲ (suena como "ñ")
    result = result.replace(/gn/gi, 'ɲ');
    
    // gl → ʎ
    result = result.replace(/gl/gi, 'ʎ');
    
    if (result === original) return null;
    hasYod = true;

    return {
        stepNumber: '9',
        result: restoreFormatting(result, formatting),
        description: 'Palatalización directa: gn→ɲ (suena como "ñ"), gl→ʎ'
    };
}

function step10(input) {
    // Asimilación de grupos consonánticos
    
    const { clean, formatting } = stripFormatting(input);
    
    let result = clean;
    const original = result;
    
    // ps → s.s (keep dot for geminate across syllables)
    result = result.replace(/p[\s.]?s/g, 's.s');
    
    // pt → t.t (keep dot for geminate across syllables)
    result = result.replace(/p[\s.]?t/g, 't.t');
    
    // mb → m.m (keep dot for geminate across syllables)
    result = result.replace(/m[\s.]?b/g, 'm.m');
    
    // mn → n.n (keep dot for geminate across syllables)
    result = result.replace(/m[\s.]?n/g, 'n.n');
    
    // ns → s (loss of n before s)
    result = result.replace(/n[\s.]?s/g, match => {
        // If there was a syllable break, keep it before s
        return match.includes('.') || match.includes(' ') ? '.s' : 's';
    });
    
    if (result === original) return null;
    
    return {
        stepNumber: '10',
        result: restoreFormatting(result, formatting),
        description: 'Asimilación de grupos consonánticos: ps→ss, pt→tt, mb→mm, mn→nn, ns→s'
    };
}

function step11(input) {
    // Palatalización de /l/ y /n/ ante /j/ (yod)
    
    const { clean, formatting } = stripFormatting(input);
    
    let result = clean;
    const original = result;
    
    // lj → ʎ (can cross syllable boundary, preserve dot before result)
    result = result.replace(/l([\s.])j/g, '$1ʎ');
    result = result.replace(/lj/g, 'ʎ');
    
    // nj → ɲ (can cross syllable boundary, preserve dot before result)
    result = result.replace(/n([\s.])j/g, '$1ɲ');
    result = result.replace(/nj/g, 'ɲ');
    
    if (result === original) return null;
    hasYod = true;

    return {
        stepNumber: '11',
        result: restoreFormatting(result, formatting),
        description: 'Palatalización de /l/ y /n/ ante /j/ (yod): lj→ʎ, nj→ɲ'
    };
}

function step12(input) {
    // Diptongación: vocales medias abiertas en posición tónica
    
    const { clean, formatting } = stripFormatting(input);
    
    let syllables = clean.split(/[\s.]+/);
    let changed = false;
    
    // Apply diphthongization only in tonic syllables
    for (let i = 0; i < syllables.length; i++) {
        // Check if this is the tonic syllable
        if (formatting.stressPositions && formatting.stressPositions.includes(i)) {
            const original = syllables[i];
            
            // ɛ → je (in tonic position)
            syllables[i] = syllables[i].replace(/ɛ/g, 'je');
            
            // ɔ → we (in tonic position)
            syllables[i] = syllables[i].replace(/ɔ/g, 'we');
            
            if (syllables[i] !== original) {
                changed = true;
            }
        }
    }
    
    if (!changed) return null;
    
    const result = syllables.join(formatting.hasBrackets || formatting.hasSlashes ? '.' : ' ');
    
    return {
        stepNumber: '12',
        result: restoreFormatting(result, formatting),
        description: 'Diptongación: /ɛ/ → /je/ (ie), /ɔ/ → /we/ (ue) en sílaba tónica'
    };
}

function step13(input) {
    // /f/ → /h/ en posición inicial (con excepciones)
    
    const { clean, formatting } = stripFormatting(input);
    
    let result = clean;
    const original = result;
    
    // Check for exceptions where f- is conserved
    // Exception 1: fr- (conserved)
    if (result.match(/^fɾ/i)) {
        return null; // No change for fr-
    }
    
    // Exception 2: fw- or fu̯- (conserved)
    if (result.match(/^f[uw]/i)) {
        return null; // No change for fw-/fu-
    }
    
    // Exception 3: fl- (sometimes conserved, sometimes not)
    let note = '';
    if (result.match(/^fl/i)) {
        note = ' (nota: fl- a veces se conserva como /f/, depende de la palabra específica)';     
    
        return {
            stepNumber: '13',
            result: restoreFormatting(result, formatting),
            description: '/f/ → /h/ en posición inicial' + note
        };
    }
    // f → h at the beginning of the word (if no exceptions apply)
    result = result.replace(/^f/i, 'h');

    if (result === original) return null;

    return {
        stepNumber: '13',
        result: restoreFormatting(result, formatting),
        description: '/f/ → /h/ en posición inicial' + note
    };
}

function step14(input) {
    // Rehilamiento: /ʎ/ → /ʒ/
    
    const { clean, formatting } = stripFormatting(input);
    
    let result = clean;
    const original = result;
    
    // ʎ → ʒ (sounds like "s" in "version" or French "j")
    result = result.replace(/ʎ/g, 'ʒ');
    
    if (result === original) return null;
    
    return {
        stepNumber: '14',
        result: restoreFormatting(result, formatting),
        description: 'Rehilamiento: /ʎ/ → /ʒ/ (suena como "si" en "version")'
    };
}

function step15a(input) {
    // Proceso fonológico 15a - Fricativización de las oclusivas sonoras intervocálicas / intersonorantes
    // Replaces b → β, d → δ, g → γ when preceded and followed by a sonorant (vowel or r/l-related).
    // If a change occurs, we render the result inside square brackets (pronunciation), converting original slashes.

    const { clean, formatting } = stripFormatting(input);
    let text = clean;

    // Define sonorant class (vowels + sonorant consonants used in your pipeline)
    const son = 'aeiouɔɛɾrlʎɲnm';

    // Regex: (sonorant) (optional separators) (b|d|g) (optional separators) (sonorant)
    const re = new RegExp(
        `([${son}])([.\\s]*)([bdg])([.\\s]*)([${son}])`,
        'gi'
    );

    // Replacement callback maps b/d/g to β/δ/γ, preserving separators and adjacent sonorants
    const mapped = text.replace(re, (match, left, sep1, stop, sep2, right) => {
        let fric;
        const s = stop.toLowerCase();
        if (s === 'b') fric = 'β';
        else if (s === 'd') fric = 'δ';
        else fric = 'γ';
        return left + sep1 + fric + sep2 + right;
    });

    if (mapped === text) return null; // no change

    // If we changed pronunciation, restore formatting but force square brackets to indicate pronunciation
    // Clone formatting to avoid mutating original object the rest of pipeline might rely on
    const fmtClone = Object.assign({}, formatting);

    // If original had slashes or brackets, we ask restoreFormatting to output square brackets.
    // (forceSquareBrackets true will convert /.../ to [...], but if original had [brackets] we keep them)
    const resultFormatted = restoreFormatting(mapped, fmtClone, { forceSquareBrackets: true });

    return {
        stepNumber: '15a',
        result: resultFormatted,
        description: 'Fricativización de oclusivas sonoras intersonorantes: b→β, d→δ, g→γ (pronunciación en corchetes)'
    };
}

function step15b_i(input) {
    // 15b (i) Sonorización iterativa: /p t k/ → /b d g/ en contexto intersonorante
    const { clean, formatting } = stripFormatting(input);
    let text = clean;

    // Sonorant class: vowels + sonorant consonants used in your pipeline
    const son = 'aeiouɔɛɾrlʎɲnm';

    // Regex: (sonorant) (optional separators) (p|t|k) (optional separators) (sonorant)
    const re = new RegExp(`([${son}])([.\\s]*)([ptk])([.\\s]*)([${son}])`, 'gi');

    let prev;
    let changed = false;

    // Apply replacements repeatedly until stable
    do {
        prev = text;
        text = text.replace(re, (match, left, sep1, stop, sep2, right) => {
            let voiced;
            const s = stop.toLowerCase();
            if (s === 'p') voiced = 'b';
            else if (s === 't') voiced = 'd';
            else /* k */ voiced = 'g';
            return left + sep1 + voiced + sep2 + right;
        });
        if (text !== prev) changed = true;
        // loop continues until no further changes
    } while (text !== prev);

    if (!changed) return null;

    return {
        stepNumber: '15b',
        result: restoreFormatting(text, formatting),
        description: '15b Sonorización intervocálica/intersonorante (iterativa): p→b, t→d, k→g'
    };
}

function step15b_ii_one_pass(input) {
    // Proceso fonológico 15b (paso ii) - Debilitamiento parcial: /b d g/ → [β δ γ] en contexto intersonorante
    const { clean, formatting } = stripFormatting(input);
    let text = clean;

    // Sonorant class: vowels
    const son = 'aeiouɔɛ';

    // Regex: (sonorant) (optional separators) (b|d|g) (optional separators) (sonorant)
    const re = new RegExp(`([${son}])([.\\s]*)([bdg])([.\\s]*)([${son}])`, 'gi');

    // Map voiced stops -> fricatives
    const mapped = text.replace(re, (match, left, sep1, stop, sep2, right) => {
        let fric;
        const s = stop.toLowerCase();
        if (s === 'b') fric = 'β';
        else if (s === 'd') fric = 'δ';
        else /* g */ fric = 'γ';
        return left + sep1 + fric + sep2 + right;
    });

    if (mapped === text) return null;

    // Force square brackets so pronunciation is shown in [...] form
    const fmtClone = Object.assign({}, formatting);
    const resultFormatted = restoreFormatting(mapped, fmtClone, { forceSquareBrackets: true });

    return {
        stepNumber: '15b',
        result: resultFormatted,
        description: '15b Debilitamiento parcial / fricativización: b→β, d→δ, g→γ (pronunciación en corchetes)'
    };
}

function step15b_ii(input) {
    let maxPasses = 10; // prevent infinite loops
    let current = input;
    let passes = 0;
    let change = null;

    do {
        change = step15b_ii_one_pass(current);
        if (change) {
            current = change.result;
        }
        passes++;
    } while (change && passes < maxPasses);

    if (current === input) return null; // no change at all

    return {
        stepNumber: '15b',
        result: current,
        description: '15b Debilitamiento parcial / fricativización iterativa: b→β, d→δ, g→γ'
    };
}


function step15c(input) {
    // Proceso fonológico 15c - Reducción de geminadas: pp→p, tt→t, kk→k
    // Always remove the FIRST consonant of the geminate so syllable boundaries remain.

    const { clean, formatting } = stripFormatting(input);
    let changed = false;

    // Work with pieces so we can keep separators (dots/spaces) and remove the consonant
    const pieces = clean.split(/([.\s]+)/); // keeps separators
    // Build entries: [{syl, sep}]
    const entries = [];
    for (let i = 0; i < pieces.length; i += 2) {
        entries.push({ syl: pieces[i] || '', sep: pieces[i + 1] || '' });
    }

    // Helper: set of targets (lowercase)
    const gemTargets = new Set(['p', 't', 'k']);

    // 1) Check boundaries between syllables: if last char of entries[i].syl
    //    equals first char of entries[i+1].syl and is in gemTargets,
    //    remove the last char from entries[i].syl (the "first" of the geminate).
    for (let i = 0; i < entries.length - 1; i++) {
        const leftSyl = entries[i].syl;
        const rightSyl = entries[i + 1].syl;
        if (!leftSyl || !rightSyl) continue;

        const leftLast = leftSyl.charAt(leftSyl.length - 1);
        const rightFirst = rightSyl.charAt(0);

        if (leftLast && rightFirst &&
            leftLast.toLowerCase() === rightFirst.toLowerCase() &&
            gemTargets.has(leftLast.toLowerCase())) {

            // Remove the last char from left syl (always the first of the geminate)
            entries[i].syl = leftSyl.slice(0, -1);
            changed = true;
        }
    }

    // 2) Reconstruct string from entries (preserves separators)
    let interim = '';
    for (let i = 0; i < entries.length; i++) {
        interim += entries[i].syl + entries[i].sep;
    }

    // 3) Collapse any remaining contiguous geminates without separators: 'pp' -> 'p' (keeps one)
    //    We want to remove the *first* of the two, effectively leaving a single instance.
    //    Using a regex that replaces double with single keeps the second char's case.
    const collapsed = interim.replace(/([ptk])\1/gi, (m, c) => {
        changed = true;
        return c; // replace "pp" with "p" (keeps the character as-is)
    });

    if (!changed) return null;

    // 4) Restore formatting (non-destructive)
    const result = restoreFormatting(collapsed, formatting);

    return {
        stepNumber: '15c',
        result: result,
        description: 'Reducción de geminadas: pp, tt, kk'
    };
}

function step15d(input) {
    // Proceso fonológico 15d - Sonorización intervocálica / intersonorante
    // 1) ts → dz
    // 2) s → z

    const { clean, formatting } = stripFormatting(input);
    let text = clean;
    let changed = false;

    // Sonorant class: vowels + sonorant consonants
    const son = 'aeiouɔɛɾrlʎɲnm';

    // 1) ts → dz sonorización intervocálica/intersonorante
    // Allow optional syllable separators '.' or ' '
    const reTs = new RegExp(`([${son}])([.\\s]*)ts([.\\s]*)([${son}])`, 'gi');

    text = text.replace(reTs, (match, left, sep1, sep2, right) => {
        changed = true;
        return left + sep1 + 'ʣ' + sep2 + right;
    });

    // 2) s → z sonorización intervocálica/intersonorante
    const reS = new RegExp(`([${son}])([.\\s]*)s([.\\s]*)([${son}])`, 'gi');

    text = text.replace(reS, (match, left, sep1, sep2, right) => {
        changed = true;
        return left + sep1 + 'z' + sep2 + right;
    });

    if (!changed) return null;

    return {
        stepNumber: '15d',
        result: restoreFormatting(text, formatting),
        description: 'Sonorización intervocálica/intersonorante: ts→ʣ, s→z'
    };
}

function step15e(input) {
    // Proceso fonológico 15e - Reducción de geminadas: mm→m, ss→s
    // Behavior: always remove the FIRST consonant of the geminate so syllable boundaries remain.

    const { clean, formatting } = stripFormatting(input);
    let changed = false;

    // Keep separators so we can respect syllable boundaries
    const pieces = clean.split(/([.\s]+)/); // keeps separators
    const entries = [];
    for (let i = 0; i < pieces.length; i += 2) {
        entries.push({ syl: pieces[i] || '', sep: pieces[i + 1] || '' });
    }

    // Targets: m and s
    const gemTargets = new Set(['m', 's']);

    // 1) Check boundaries between syllables: if last char of entries[i].syl
    //    equals first char of entries[i+1].syl and is in gemTargets,
    //    remove the last char from entries[i].syl (the first of the geminate).
    for (let i = 0; i < entries.length - 1; i++) {
        const leftSyl = entries[i].syl;
        const rightSyl = entries[i + 1].syl;
        if (!leftSyl || !rightSyl) continue;

        const leftLast = leftSyl.charAt(leftSyl.length - 1);
        const rightFirst = rightSyl.charAt(0);

        if (leftLast && rightFirst &&
            leftLast.toLowerCase() === rightFirst.toLowerCase() &&
            gemTargets.has(leftLast.toLowerCase())) {

            // Remove the last char from left syl (the first of the geminate)
            entries[i].syl = leftSyl.slice(0, -1);
            changed = true;
        }
    }

    // 2) Reconstruct string (preserving separators)
    let interim = '';
    for (let i = 0; i < entries.length; i++) {
        interim += entries[i].syl + entries[i].sep;
    }

    // 3) Collapse any remaining contiguous geminates without separators: 'mm' -> 'm', 'ss' -> 's'
    //    Remove the first of the pair by replacing double with single (keeps second char's case).
    const collapsed = interim.replace(/([ms])\1/gi, (m, c) => {
        changed = true;
        return c;
    });

    if (!changed) return null;

    const result = restoreFormatting(collapsed, formatting);

    return {
        stepNumber: '15e',
        result: result,
        description: 'Reducción de geminadas: mm y ss'
    };
}

function step16(input) {
    // Proceso fonológico 16 - Palatalización de geminadas ll→ʎ, nn→ɲ
    // Rules:
    // - If geminate crosses syllable boundary (leftSyl ends with same consonant as rightSyl starts),
    //   remove the first (last char of left syl) and palatalize the surviving initial of right syl.
    // - If contiguous geminate without separator ('ll' or 'nn'), collapse to single and palatalize
    //   the remaining consonant only if it is followed by a vowel (i.e. becomes an onset).

    const { clean, formatting } = stripFormatting(input);
    let changed = false;

    // Keep separators so we can respect syllable boundaries
    const pieces = clean.split(/([.\s]+)/); // keeps separators
    const entries = [];
    for (let i = 0; i < pieces.length; i += 2) {
        entries.push({ syl: pieces[i] || '', sep: pieces[i + 1] || '' });
    }

    // 1) Boundary-case: if left last char == right first char and is l/n,
    //    remove left last and palatalize the right-first (survivor).
    for (let i = 0; i < entries.length - 1; i++) {
        const leftSyl = entries[i].syl;
        const rightSyl = entries[i + 1].syl;
        if (!leftSyl || !rightSyl) continue;

        const leftLast = leftSyl.charAt(leftSyl.length - 1);
        const rightFirst = rightSyl.charAt(0);

        if (!leftLast || !rightFirst) continue;

        const lc = leftLast.toLowerCase();
        const rc = rightFirst.toLowerCase();

        if ((lc === 'l' && rc === 'l') || (lc === 'n' && rc === 'n')) {
            // remove the first of the geminate (last char of left syl)
            entries[i].syl = leftSyl.slice(0, -1);
            changed = true;

            // palatalize the surviving consonant (first char of right syl)
            const pal = lc === 'l' ? 'ʎ' : 'ɲ';
            entries[i + 1].syl = pal + rightSyl.slice(1);
        }
    }

    // 2) Reconstruct interim string (preserving separators)
    let interim = '';
    for (let i = 0; i < entries.length; i++) {
        interim += entries[i].syl + entries[i].sep;
    }

    // 3) Handle contiguous geminates without separators: look for 'll' or 'nn' in interim.
    //    Collapse them to single and palatalize only if followed by a vowel.
    //    We'll iterate matches to check the following character.
    interim = interim.replace(/(ll|LL|nn|NN)/g, (m, p, offset, str) => {
        // p is the matched pair 'll' or 'nn' (case preserved by match).
        const lower = p.charAt(0).toLowerCase();
        const nextChar = str[offset + p.length] || '';
        const isNextVowel = /[aeiouɔɛ]/i.test(nextChar);

        if (isNextVowel) {
            // palatalize (use lowercase palatal symbols)
            changed = true;
            return lower === 'l' ? 'ʎ' : 'ɲ';
        } else {
            // collapse to single consonant (keep case of second char)
            changed = true;
            return p.charAt(1);
        }
    });

    if (!changed) return null;

    // Restore formatting and return
    const result = restoreFormatting(interim, formatting);

    return {
        stepNumber: '16',
        result: result,
        description: 'Palatalización de geminadas: ll→ʎ, nn→ɲ'
    };
}

function step17(input) {
    // Proceso fonológico 17 - Palatalización inicial de /kl/, /pl/, /fl/ → ʎ
    // Applies only in word-initial position. If fl is matched, include a special note.

    const { clean, formatting } = stripFormatting(input);
    if (!clean || typeof clean !== 'string') return null;

    // Match at word start: kl | pl | fl  (case-insensitive)
    const m = clean.match(/^([kkpKPlPfF])?([kKpPfF]l)/); // quick guard but we'll use a clearer regex below

    // Clearer regex: capture cluster exactly at start
    const re = /^((?:kl|KL|Kl|kL|pl|PL|Pl|pL|fl|FL|Fl|fL))/;
    const match = clean.match(re);
    if (!match) return null;

    const cluster = match[1].toLowerCase(); // 'kl' 'pl' or 'fl'
    // build replacement: initial palatal ʎ + rest of string after cluster
    const remainder = clean.slice(match[0].length);
    const replaced = 'ʎ' + remainder;

    // Prepare description, with special note if fl occurred
    let note = '';
    if (cluster === 'fl') {
        note = ' (nota: "fl" no siempre palataliza en todos los dialectos/históricos — cambio aplicado con precaución)';
    }

    return {
        stepNumber: '17',
        result: restoreFormatting(replaced, formatting),
        description: `Palatalización inicial: ${cluster} → ʎ${note}`
    };
}

function step18_i(input) {
    const segundaSincopaCheckbox = document.getElementById('segundaSincopaCheckbox');
    // Only run when checkbox is explicitly checked
    if (!segundaSincopaCheckbox || !segundaSincopaCheckbox.checked) return null;

    const { clean, formatting } = stripFormatting(input);
    const marked = markIntertonicSyllables(clean, formatting);
    if (!marked) return null;

    return {
        stepNumber: '18',
        result: restoreFormatting(marked, formatting),
        description: 'Desaparición (síncopa) de sílabas átonas intertónicas (segunda aplicación): marcar vocales con ∅'
    };
}

function step18_ii(input) {
    const segundaSincopaCheckbox = document.getElementById('segundaSincopaCheckbox');
    if (!segundaSincopaCheckbox || !segundaSincopaCheckbox.checked) return null;

    const { clean, formatting } = stripFormatting(input);
    const applied = applyIntertonicRemoval(clean, formatting);
    if (!applied) return null;

    return {
        stepNumber: '18',
        result: restoreFormatting(applied, formatting),
        description: 'Desaparición (síncopa) de sílabas átonas intertónicas (segunda aplicación): eliminar ∅ y unir consonantes (regla de distribución de consonantes ajustada)'
    };
}

function step19(input) {
    // Proceso fonológico 19 - Pérdida de /t/, /d/, /k/ finales

    const mantenerEFinalCheckbox = document.getElementById('mantenerEFinalCheckbox');
    // Skip when checkbox is not checked
    if (mantenerEFinalCheckbox) return null;

    const { clean, formatting } = stripFormatting(input);
    let syllables = clean.split(/[\s.]+/);

    let changed = false;

    // Remove final /t/, /d/, /k/ in each syllable if it's at the end of the word
    for (let i = 0; i < syllables.length; i++) {
        const syl = syllables[i];
        if (i === syllables.length - 1) { // last syllable
            const newSyl = syl.replace(/[tdk]$/i, '');
            if (newSyl !== syl) {
                syllables[i] = newSyl;
                changed = true;
            }
        }
    }

    if (!changed) return null;

    const delimiter = formatting.hasBrackets || formatting.hasSlashes ? '.' : ' ';
    const result = syllables.join(delimiter);

    return {
        stepNumber: '19',
        result: restoreFormatting(result, formatting),
        description: 'Pérdida de (elisión) /t/, /d/, /k/ finales (sílabas reajustadas)'
    };
}

function step20(input) {
    // Proceso fonológico 20 - Pérdida de /e/ final tras consonantes simples
    
    // Checkbox is for the *exception*: mantener la e final
    const mantenerCheckbox = document.getElementById('mantenerEFinalCheckbox');
    // If the checkbox is checked, we skip this entire process (keep the 'e')
    if (mantenerCheckbox && mantenerCheckbox.checked) return null;

    const { clean, formatting } = stripFormatting(input);
    const words = clean.split(/\s+/);
    let changed = false;

    const newWords = words.map(word => {
        // Split the word by the syllable delimiter (assumed to be '.')
        const syllables = word.split('.');
        if (syllables.length < 2) return word; // Needs at least two syllables to have a final *vowel* syllable to delete

        const lastIndex = syllables.length - 1;
        let lastSyl = syllables[lastIndex];
        let prevSyl = syllables[lastIndex - 1];

        // Regex: simple consonant + e at end (case-insensitive for C and e)
        // C must be one of the non-vowel IPA symbols used in your pipeline
        const consonantMatch = lastSyl.match(/^([bcdfghjklmnpqrstvwxyzβɣδɸθʃʒʧʤŋɲʎɾ])e$/i);

        if (consonantMatch) {
            const finalConsonant = consonantMatch[1];
            
            // 1. Append the consonant to the second-to-last syllable
            syllables[lastIndex - 1] += finalConsonant;
            
            // 2. Remove the last syllable
            syllables.pop(); 
            
            changed = true;
        }

        return syllables.join('.');
    });

    if (!changed) return null;

    const result = newWords.join(' ');
    return {
        stepNumber: '20',
        result: restoreFormatting(result, formatting),
        description: 'Pérdida (elisión) de /e/ final tras consonantes simples, con sílaba final fusionada'
    };
}

function step21(input) {
    const { clean, formatting } = stripFormatting(input);
    let text = clean;

    let changed = false;

    // m.r → m.bɾ
    const mRregex = /m\.ɾ/gi;
    if (mRregex.test(text)) {
        text = text.replace(mRregex, 'm.bɾ');
        changed = true;
    }

    // m.l → l.m
    const mLregex = /m\.l/gi;
    if (mLregex.test(text)) {
        text = text.replace(mLregex, 'l.m');
        changed = true;
    }

    if (!changed) return null;

    const result = text.split(/\s+/).join(formatting.hasBrackets || formatting.hasSlashes ? '.' : ' ');

    return {
        stepNumber: '21',
        result: restoreFormatting(result, formatting),
        description: "Ajuste de grupos consonánticos (epéntesis, disimilación, metátesis): mɾ → mbɾ, ml → lm"
    };
}

function step22(input) {
    const { clean, formatting } = stripFormatting(input);
    let syllables = clean.split(/[\s.]+/);

    let changed = false;

    if (syllables.length > 0) {
        let firstSyl = syllables[0];
        const originalStressOnFirst = formatting.stressPositions.includes(0);

        // Handle skw case first
        if (/^skw/i.test(firstSyl)) {
            const rest = firstSyl.slice(3); // remove 'skw'
            const newSyllables = ['es', 'kw' + rest];
            syllables.splice(0, 1, ...newSyllables);
            changed = true;
        }
        // sp, st, sk cases
        else if (/^(sp|st|sk)/i.test(firstSyl)) {
            const match = firstSyl.match(/^(sp|st|sk)/i)[0];
            const rest = firstSyl.slice(match.length);
            const newSyllables = ['es', match[1] + rest];
            syllables.splice(0, 1, ...newSyllables);
            changed = true;
        }

        // Adjust stress only if it was on the first syllable
        if (changed && originalStressOnFirst) {
            formatting.stressPositions = formatting.stressPositions.map(pos =>
                pos === 0 ? 1 : pos
            );
        }
    }

    if (!changed) return null;

    const result = syllables.join(formatting.hasBrackets || formatting.hasSlashes ? '.' : ' ');

    return {
        stepNumber: '22',
        result: restoreFormatting(result, formatting),
        description: 'Prótesis de /s/ agrupada: esp-, est-, esk-'
    };
}

function step23(input) {
    const { clean, formatting } = stripFormatting(input);
    let syllables = clean.split(/[\s.]+/);

    if (syllables.length === 0) return null;

    let changed = false;

    // Handle initial h
    let firstSyl = syllables[0];

    // Remove initial /h/ or /H/
    if (/^h/i.test(firstSyl)) {
        firstSyl = firstSyl.replace(/^h/i, '');
        changed = true;
    }

    // Special case: if first syl now starts with j (from diptongo /je/),
    // convert /j/ → /ʝ/
    if (/^j/.test(firstSyl)) {
        firstSyl = firstSyl.replace(/^j/, 'ʝ');
        changed = true;
    }

    syllables[0] = firstSyl;

    if (!changed) return null;

    const result = syllables.join(formatting.hasBrackets || formatting.hasSlashes ? '.' : ' ');

    return {
        stepNumber: '23',
        result: restoreFormatting(result, formatting),
        description: 'Pérdida de /h/ inicial y conversión de /j/ → /ʝ/ si queda al inicio'
    };
}

function step24(input) {
    const { clean, formatting } = stripFormatting(input);
    let syllables = clean.split(/[\s.]+/);

    if (syllables.length === 0) return null;

    let changed = false;

    // Flatten to string to make context checks easier
    let chars = clean.split('');
    const softBeta = 'β';
    const hardB = 'b';
    const nasals = 'mnɲ';

    for (let i = 0; i < chars.length; i++) {
        if (chars[i] === softBeta) {
            let replaceWithB = false;

            // If it’s the first character of the first syllable, make it [b]
            if (i === 0) replaceWithB = true;

            // If preceded by a nasal, make it [b]
            else if (i > 0 && nasals.includes(chars[i - 1])) replaceWithB = true;

            chars[i] = replaceWithB ? hardB : softBeta;
            changed = true;
        }
    }

    if (!changed) return null;

    const result = chars.join('');
    
    return {
        stepNumber: '24',
        result: restoreFormatting(result, formatting),
        description: 'Confluencia /b/ y /β/: [b] inicial y postnasal, [β] en todos los demás contextos'
    };
}

function step25(input) {
    const { clean, formatting } = stripFormatting(input);
    let text = clean;

    let changed = false;

    // Replace /ʦ/ with /s̪/ and /ʣ/ with /z̪/
    text = text.replace(/ʦ/g, () => { changed = true; return 's̪'; });
    text = text.replace(/ʣ/g, () => { changed = true; return 'z̪'; });

    if (!changed) return null;

    return {
        stepNumber: '25',
        result: restoreFormatting(text, formatting),
        description: 'Desafricación: /ʦ/ → /s̪/, /ʣ/ → /z̪/'
    };
}

function step26(input) {
    const { clean, formatting } = stripFormatting(input);
    let text = clean;
    let changed = false;

    // 1. Devoicing of Voiced Dental Sibilant (from step 25)
    // /z̪/ (desde step 25) ensordece a /s̪/ (sibilante dental sorda)
    text = text.replace(/z̪/g, () => {
        changed = true;
        return 's̪'; // Dental sibilant (with combining bridge below U+032A)
    });

    // 2. Devoicing of Voiced Alveolar Sibilant (from step 15d/intervocalic voicing)
    // /z/ → /s̺/ (sibilante ápico-alveolar sorda)
    text = text.replace(/z/g, () => {
        changed = true;
        return 's̺'; // Apico-alveolar (with combining inverted bridge below U+033A)
    });
   
    // 3. Convert remaining plain /s/ to apico-alveolar /s̺/
    // BUT skip if already has a diacritic
    text = text.replace(/s(?![̪̺])/g, () => {
        changed = true;
        return 's̺';
    });

    // 4. Devoicing of Voiced Postalveolar Fricative
    // /ʒ/ → /ʃ/ (fricativa postalveolar sorda)
    text = text.replace(/ʒ/g, () => {
        changed = true;
        return 'ʃ'; // Use ʃ instead of ʃ
    });

    if (!changed) return null;

    return {
        stepNumber: '26',
        result: restoreFormatting(text, formatting),
        description: 'Ensordecimiento de las sibilantes sonoras: /z̪/→/s̪/, /z/→/s̺/, /ʒ/→/ʃ/'
    };
}

function step27_28(input) {
    const { clean, formatting } = stripFormatting(input);
    let syllables = clean.split(/[\s.]+/);

    // Map sibilantes and fricativa velar
    syllables = syllables.map(syl => {
        let newSyl = syl;

        // /s̪/ → /θ/
        if (syl.includes('s̪')) {
            newSyl = newSyl.replace(/s̪/g, 'θ');
            changed = true;
        }
        // /ʃ/ → /x/
        if (syl.includes('ʃ')) {
            newSyl = newSyl.replace(/ʃ/g, 'x');
            changed = true;
        }

        // /s̺/ stays the same, /x/ stays the same
        return newSyl;
    });

    const result = syllables.join(formatting.hasBrackets || formatting.hasSlashes ? '.' : ' ');

    return {
        stepNumber: '27/28',
        result: restoreFormatting(result, formatting),
        description: 'Proceso 27 / 28: Castellano (s̪→θ, ʃ→x, s̺ stays, x stays)'
    };
}

function step27b_28b(input) {
    const { clean, formatting } = stripFormatting(input);
    let syllables = clean.split(/[\s.]+/);
    let changed = false;

    syllables = syllables.map(syl => {
        let newSyl = syl;

        // /s̪/ → /s/
        if (syl.includes('s̪')) {
            newSyl = newSyl.replace(/s̪/g, 's');
            changed = true;
        }

        // /s̺/ → /s/
        if (syl.includes('s̺')) {
            newSyl = newSyl.replace(/s̺/g, 's');
            changed = true;
        }

        // /ʃ/ → /x/
        if (syl.includes('ʃ')) {
            newSyl = newSyl.replace(/ʃ/g, 'x');
            changed = true;
        }

        return newSyl;
    });

    const result = syllables.join(formatting.hasBrackets || formatting.hasSlashes ? '.' : ' ');

    return {
        stepNumber: '27b/28b',
        result: restoreFormatting(result, formatting),
        description: 'Proceso 27/28b: Seseo (s̪→s, s̺→s, ʃ→x)'
    };
}

function step27_28_and_seseo(input) {
    // 1. Ejecutar Proceso Castellano (27/28)
    const castellanoResult = step27_28(input);
    if (!castellanoResult) return null;

    // 2. Ejecutar Proceso Seseo (27b/28b)
    const seseoResult = step27b_28b(input);
    
    // Si la versión seseo no cambió (lo cual es raro en este punto),
    // usa la salida de la versión castellana para ambos.
    const seseoFinal = seseoResult ? seseoResult.result : castellanoResult.result;

    // Extract individual descriptions
    const castellanoDesc = castellanoResult.description.replace('Proceso 27 / 28: ', '');
    const seseoDesc = seseoResult ? seseoResult.description.replace('Proceso 27/28b: ', '') : 'Sin cambios';
    
    // Create a combined description for the UI with better formatting
    const combinedDescription = `Castellano: ${castellanoDesc}  •  Seseo: ${seseoDesc}`;
    
    return {
        stepNumber: '27/28',
        result: castellanoResult.result, // <<-- ESTE ES EL VALOR QUE CONTINÚA EN EL PROCESO
        description: combinedDescription,
        // Agregamos una propiedad especial para el resultado dual
        dualResult: {
            castellano: castellanoResult.result,
            castellanoDesc: castellanoDesc,
            seseo: seseoFinal,
            seseoDesc: seseoDesc
        }
    };
}

// Track yod presence for later steps
let hasYod = false;
let inflectionAvailable = false;

// Array of all step functions - ADD YOUR FUNCTIONS TO THIS ARRAY
const stepFunctions = [
    step0_i,
    step0_ii,
    step0_iii_weights,
    step0_iii_tonic,
    step0_iv,
    step1,
    step2,
    step3_i,
    step3_ii,
    step3_iii,
    step3_iv,
    step4,
    step5, //yod
    stepI_inflection,
    step6_i, //yod
    stepI_inflection,
    step6_ii, //yod
    stepI_inflection,
    step7_i,
    step7_ii,
    step8_i,
    step8_ii,
    step9_i, //yod
    stepI_inflection,
    step9_ii, //yod
    stepI_inflection,
    step9_iii, //yod
    stepI_inflection,
    step10,
    step11, //yod
    stepI_inflection,
    step12,
    step13,
    step14,
    step15a,
    step15b_i,
    step15b_ii,
    step15c,
    step15d,
    step15e,
    step16,
    step17,
    step18_i,
    step18_ii,
    step19,
    step20,
    step21,
    step22,
    step23,
    step24,
    step25,
    step26,
    step27_28_and_seseo
    // Add more step functions here as you create them
];

function processWord() {
    const input = document.getElementById('wordInput');
    const trimmed = input.value.trim();
    
    // Reset yod flag
    hasYod = false;
    inflectionAvailable = true;

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
        
        // Determinar el color... (resto de la lógica de color)
        let stepColor;
        const stepNum = step.stepNumber.toString();
        
        if (stepNum === 'Inicio' || stepNum.startsWith('0')) {
            stepColor = 'var(--color-step-0)'; 
        } else if (stepNum > '22' || stepNum === '27/28') { 
            stepColor = 'var(--color-step-modern)';
        } else {
            stepColor = 'var(--color-step-medieval)';
        }
        
        let resultHTML = '';
        let descriptionHTML = '';

        if (step.dualResult) {
            // MODO DUAL: Show both Castellano and Seseo phonetic results
            resultHTML = `
                <div class="dual-result">
                    <div class="dual-column">
                        <p class="dual-title">Castellano:</p>
                        <p class="dual-value">${step.dualResult.castellano}</p>
                    </div>
                    <div class="dual-column">
                        <p class="dual-title">Seseo:</p>
                        <p class="dual-value">${step.dualResult.seseo}</p>
                    </div>
                </div>
            `;
            // The description uses the single, combined string you previously set
            descriptionHTML = `<p class="step-description">${spanishSentenceCase(step.description)}</p>`;
        } else {
            // MODO NORMAL
            resultHTML = `<div class="step-result"><p>${step.result}</p></div>`;
            descriptionHTML = `<p class="step-description">${spanishSentenceCase(step.description)}</p>`;
        }

        stepCard.innerHTML = `
            <div class="step-content">
                <div class="step-number" style="background: ${stepColor};">${step.stepNumber}</div>
                <div class="step-details">
                    ${resultHTML}
                    ${descriptionHTML}
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