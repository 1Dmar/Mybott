// Comprehensive list of profanity, slurs, and inappropriate content

const badWords = [
    // English Profanity
    'anal', 'anus', 'arse', 'ass', 'ballsack', 'balls', 'bastard', 'bitch', 'biatch', 'bloody',
    'blowjob', 'blow job', 'bollock', 'bollok', 'boner', 'boob', 'bugger', 'bum', 'butt', 'buttplug',
    'clitoris', 'cock', 'coon', 'crap', 'cunt', 'damn', 'dick', 'dildo', 'dyke', 'fag', 'feck',
    'fellate', 'fellatio', 'felching', 'fuck', 'f u c k', 'fudgepacker', 'fudge packer', 'flange',
    'homo', 'jerk', 'jizz', 'knobend', 'knob end', 'labia', 'lmfao', 'muff', 'nigger', 'nigga',
    'omg', 'penis', 'piss', 'poop', 'prick', 'pube', 'pussy', 'queer', 'scrotum', 'sex', 'shit',
    's hit', 'sh1t', 'slut', 'smegma', 'spunk', 'tit', 'tosser', 'turd', 'twat', 'vagina', 'wank',
    'whore', 'wtf', 'asshole', 'bullshit', 'clusterfuck', 'cockblock', 'cocksucker', 'cum', 'cumming',
    'cuntbag', 'dickhead', 'dickwad', 'dike', 'dumbass', 'fagbag', 'faggit', 'faggot', 'fagtard',
    'fatass', 'fck', 'fcking', 'fk', 'fking', 'fuckass', 'fucked', 'fucker', 'fucking', 'fucktard',
    'fuk', 'fuking', 'fux', 'fvck', 'fxck', 'goddamn', 'goddamnit', 'gtfo', 'handjob', 'hardcore',
    'humping', 'jackass', 'jackoff', 'jerkoff', 'kike', 'kunt', 'lesbo', 'masturbate', 'milf', 'mothafucka',
    'motherfucker', 'motherfucking', 'mtherfucker', 'mthrfucker', 'mutherfucker', 'nazi', 'negro', 'niglet',
    'nignog', 'nutsack', 'paki', 'pecker', 'penisfucker', 'pissflaps', 'piss off', 'pisshead', 'pole smoker',
    'poon', 'poontang', 'porn', 'porno', 'pornography', 'punanny', 'punta', 'pussies', 'pussylicking',
    'puto', 'queef', 'raghead', 'rectum', 'retard', 'rimjob', 'rimming', 'sadist', 'sandnigger', 'schlong',
    'screwing', 'semen', 'shag', 'shaved pussy', 'shemale', 'shitcunt', 'shitdick', 'shitface', 'shitfaced',
    'shithead', 'shithole', 'shithouse', 'shitting', 'shitty', 'shiz', 'skank', 'skeet', 'skullfuck', 'slag',
    'slanteye', 'slutbag', 'snatch', 'spic', 'spick', 'splooge', 'spook', 'suckass', 'taint', 'tard', 'threesome',
    'titfuck', 'tits', 'titty', 'titties', 'tittyfuck', 'toke', 'towelhead', 'tranny', 'transsexual', 'twunt',
    'uglyfuck', 'undies', 'urine', 'vibrator', 'vulva', 'wanker', 'wetback', 'whorebag', 'whoreface', 'xxx',
    
    // Arabic Profanity (Arabic Script)
    'كس', 'طيز', 'زب', 'منيوك', 'شرموطة', 'قحبة', 'عرص', 'خول', 'لبوة', 'متناك', 'سكس', 'اباحي',
    'كسمك', 'يا بن المتناكة', 'يا بن الشرموطة', 'يا بن القحبة', 'يا خول', 'يا عرص', 'يا منيوك',
    'يا طيز', 'يا زب', 'يا كس', 'يا لبوة', 'يا متناك', 'يا قواد', 'يا ديوث', 'يا واطي',
    'يا حقير', 'يا سافل', 'يا منحط', 'يا نجس', 'يا كلب', 'يا حمار', 'يا بقرة', 'يا خنزير',
    
    // Arabic Profanity (Latin letters - Arabic chat alphabet)
    'kos', 'koss', 'kosomak', 'kosomok', 'kosomich', 'kosomk', 'kosomkm', 'kosomkum',
    'a7a', 'ahh', 'a7eeh', 'zabour', 'zobr', 'zobi', 'manyok', 'manyook', 'manook', 'kosom',
    'sharmoota', 'sharmota', 'sharmouta', 'shrmota', 'sharmoot', 'sharmt', 'shrmoota',
    'kahba', 'ka7ba', '7be', '7bba', 'ka7be', '7abbe', '7be',
    'teez', 'teeze', 'teiz', 'tiz', 'tze', 'wata', 'wta', 'wt',
    'labwa', 'labwe', 'lbwa', 'kalb', 'kalbe', 'klb', 'kilab',
    'bnayya', 'bint', 'bnat', 'bnet', 'merta', 'mrt', 'mrte',
    'zamel', 'zml', 'zamel', 'zamil', 'zamel', 'looti', 'lwati', 'lt',
    
    // Threats/Violence
    'kill yourself', 'kys', 'kill urself', 'end your life', 'commit suicide', 'hang yourself',
    'shoot yourself', 'cut yourself', 'slit your wrists', 'i hope you die', 'die in a fire',
    'murder', 'rape', 'rapist', 'raping', 'molest', 'molestation', 'pedophile', 'pedo', 'predator',
    'school shooting', 'bomb', 'terrorist', 'isis', 'al-qaeda', 'kkk', 'ku klux klan',
    
    // Discriminatory
    'chink', 'gook', 'wetback', 'beaner', 'cracker', 'whitey', 'honky', 'redskin', 'savage',
    'retarded', 'autistic', 'downie', 'cripple', 'spastic', 'spaz',
    
    // Sexual Harassment
    'send nudes', 'nudes?', 'nude pics', 'send feet', 'feet pics', 'dick pic', 'cock pic',
    'show me your', 'show ur', 'send me your', 'sugar daddy', 'sugar baby', 'onlyfans'
];

// Additional patterns for detection
const badPatterns = [
    /n+[i1l]+[g9]{2,}[e3]*[r5]+/i,  // n-word variations
    /f+[u4]+[c k]+[k]+/i,            // f-word variations
    /b+[i1]+[t7]+[c k]+[h]+/i,       // b-word variations
    /s+[h]+[i1]+[t7]+/i,             // s-word variations
    /a+[s5]+[s5]+/i,                 // a-word variations
    /c+[u4]+[n7]+[t7]+/i,            // c-word variations
    /d+[i1]+[c k]+[k]+/i,            // d-word variations
    /p+[u4]+[s5]+[s5]+[y]+/i,        // p-word variations
];

module.exports = {
    badWords,
    badPatterns,
    
    // Check function
    containsBadWords: (text) => {
        if (!text) return false;
        const lowerText = text.toLowerCase();
        
        // Check exact matches and inclusions
        const hasBadWord = badWords.some(word => {
            // For Arabic characters, we use a different approach as \b might not work as expected
            const isArabic = /[\u0600-\u06FF]/.test(word);
            if (isArabic) {
                return lowerText.includes(word.toLowerCase());
            } else {
                const regex = new RegExp(`\\b${word.toLowerCase()}\\b`, 'i');
                return regex.test(lowerText);
            }
        });
        
        if (hasBadWord) return true;
        
        // Check patterns
        return badPatterns.some(pattern => pattern.test(lowerText));
    }
};
