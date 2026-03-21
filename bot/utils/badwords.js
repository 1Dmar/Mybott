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
    
    // Discord/Online Terms
    'discord.gg', 'discord.com/invite', 'discordapp.com/invite', 'discord.me', 'discord.io',
    'discord.li', 'discord.link', 'bit.ly', 'short.link', 'tinyurl', 'goo.gl', 'ow.ly',
    
    // Threats/Violence
    'kill yourself', 'kys', 'kill urself', 'end your life', 'commit suicide', 'hang yourself',
    'shoot yourself', 'cut yourself', 'slit your wrists', 'i hope you die', 'die in a fire',
    'murder', 'rape', 'rapist', 'raping', 'molest', 'molestation', 'pedophile', 'pedo', 'predator',
    'school shooting', 'bomb', 'terrorist', 'isis', 'al-qaeda', 'kkk', 'ku klux klan',
    
    // Discriminatory
    'chink', 'gook', 'wetback', 'beaner', 'cracker', 'whitey', 'honky', 'redskin', 'savage',
    'retarded', 'autistic', 'downie', 'cripple', 'spastic', 'spaz', ' Window', ' Window licker',
    
    // Sexual Harassment
    'send nudes', 'nudes?', 'nude pics', 'send feet', 'feet pics', 'dick pic', 'cock pic',
    'show me your', 'show ur', 'send me your', 'sugar daddy', 'sugar baby', 'onlyfans',
    
    // Bypass Attempts
    'f u c k', 's h i t', 'b i t c h', 'a s s', 'd i c k', 'n i g g a', 'n i g g e r',
    'f*ck', 'f**k', 'f***', 's**t', 's***', 'b***h', 'a**', 'd**k', 'n****', 'n*****',
    'f uck', 'fu ck', 'fuc k', 'sh it', 'shi t', 'b it ch', 'bit ch', 'a s s h o l e',
    'b1tch', 'sh1t', 'f4g', 'f4gg0t', 'n1gger', 'n1gga', 'p0rn', 'p0rno', 's3x', 's3xy',
    'c0ck', 'c0cksucker', 'd1ck', 'd1ckhead', 'pu$$y', 'pu$$ies', 'a$$', 'a$$hole',
    
    // Arabic Profanity (Latin letters - Arabic chat alphabet)
    'kos', 'koss', 'kosomak', 'kosomok', 'kosomich', 'kosomk', 'kosomkm', 'kosomkum',
    'a7a', 'ahh', 'a7eeh', 'zabour', 'zobr', 'zobi', 'manyok', 'manyook', 'manook', 'kosom',
    'sharmoota', 'sharmota', 'sharmouta', 'shrmota', 'sharmoot', 'sharmt', 'shrmoota',
    'kahba', 'ka7ba', '7be', '7bba', 'ka7be', '7abbe', '7be',
    'teez', 'teeze', 'teiz', 'tiz', 'tze', 'wata', 'wta', 'wt',
    'labwa', 'labwe', 'lbwa', 'kalb', 'kalbe', 'klb', 'kilab',
    'bnayya', 'bint', 'bnat', 'bnet', 'merta', 'mrt', 'mrte',
    'zamel', 'zml', 'zamel', 'zamil', 'zamel', 'looti', 'lwati', 'lt',
    'kafir', 'kfer', 'yahud', 'yahoodi', 'muslim', 'islam', // When used as insults
    
    // Drug References
    'cocaine', 'heroin', 'meth', 'crystal meth', 'crack', 'weed', 'marijuana', 'cannabis',
    'lsd', 'acid', 'ecstasy', 'mdma', 'molly', 'ketamine', 'kush', 'dope', 'stoned', 'high af',
    
    // Additional Variations
    'cumming', 'cumshot', 'blowjob', 'blow job', 'handjob', 'hand job', 'facial', 'creampie',
    'deepthroat', 'deep throat', 'gangbang', 'gang bang', 'bukkake', 'milf', 'gilf', 'dilf',
    'step sister', 'step bro', 'step mom', 'step dad', 'incest', 'bestiality', 'beastiality',
    'necrophilia', 'scat', 'fart', 'farting', 'pooping', 'peeing', 'urinating', 'defecating',
    
    // Common Insults
    'stupid', 'idiot', 'moron', 'dumbass', 'retard', 'autistic', 'spastic', 'cripple', 'lame',
    'gay', 'fag', 'faggot', 'queer', 'homo', 'lesbo', 'dyke', 'tranny', 'shemale', 'trap',
    'incel', 'simp', 'cuck', 'cuckold', 'beta', 'virgin', 'neckbeard', 'weeb', 'weeaboo'
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
        
        // Check exact matches
        const hasBadWord = badWords.some(word => lowerText.includes(word.toLowerCase()));
        if (hasBadWord) return true;
        
        // Check patterns
        return badPatterns.some(pattern => pattern.test(lowerText));
    }
};
