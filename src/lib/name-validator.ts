/**
 * Candidate Full Name Validator (Apple Pre-Exam Identity Gate)
 * Enforces strict naming rules:
 * 1. Cannot start with a number, punctuation mark, or special character.
 * 2. Cannot contain numbers or special symbols anywhere.
 * 3. Cannot contain profane, vulgar, offensive, or troll words (Vietnamese & English).
 * 4. Must have at least 5 letters and a proper multi-word full name structure (Họ & Tên đàng hoàng).
 */

export interface NameValidationResult {
  isValid: boolean;
  normalizedName: string;
  letterCount: number;
  wordCount: number;
  errorMessage: string | null;
  rules: {
    noLeadingNumberOrSymbol: boolean;
    onlyValidLetters: boolean;
    minFiveLettersAndProperWords: boolean;
    respectfulLanguage: boolean;
  };
}

const VIETNAMESE_VOWEL_REGEX =
  /[aăâeêioôơuưyáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;

// Exact accented profane/vulgar/offensive tokens in Vietnamese
const ACCENTED_BANNED_WORDS = new Set([
  'đụ',
  'địt',
  'lồn',
  'cặc',
  'buồi',
  'đĩ',
  'đéo',
  'đếch',
  'đít',
  'cứt',
  'ỉa',
  'đái',
  'chó',
  'ngu',
  'đần',
  'khốn',
  'điên',
  'khùng',
  'ngáo',
  'cút',
  'biến',
  'mày',
  'tao',
]);

// Unaccented profane, vulgar, insult, and troll tokens (Vietnamese & English)
const UNACCENTED_BANNED_WORDS = new Set([
  'dit',
  'lon',
  'cac',
  'buoi',
  'deo',
  'dm',
  'dkm',
  'dmm',
  'dcm',
  'dcmm',
  'vcl',
  'vl',
  'vkl',
  'cc',
  'cl',
  'clm',
  'cmn',
  'cmm',
  'sml',
  'ngu',
  'chode',
  'sucvat',
  'sucsinh',
  'khonnan',
  'matday',
  'vohoc',
  'concho',
  'thangcho',
  'thangngu',
  'conngu',
  'conlon',
  'thanglon',
  'memay',
  'bomay',
  'chamay',
  'ongmay',
  'bamay',
  'nhamay',
  'fuck',
  'fck',
  'fuk',
  'fucking',
  'fucker',
  'shit',
  'bitch',
  'bastard',
  'asshole',
  'dick',
  'cock',
  'pussy',
  'cunt',
  'whore',
  'slut',
  'idiot',
  'stupid',
  'moron',
  'retard',
  'loser',
  'scum',
  'trash',
  'wtf',
  'stfu',
  'lmao',
  'admin',
  'administrator',
  'root',
  'anonymous',
  'unknown',
  'null',
  'undefined',
  'asdf',
  'qwerty',
  'zxcv',
  'abcd',
  'haha',
  'hehe',
  'hihi',
  'huhu',
  'kaka',
  'blabla',
]);

const BANNED_PHRASES_UNACCENTED = [
  'me may',
  'bo may',
  'cha may',
  'con cho',
  'thang cho',
  'thang ngu',
  'con ngu',
  'suc vat',
  'suc sinh',
  'khon nan',
  'mat day',
  'vo hoc',
  'do ngu',
  'do dien',
  'dit me',
  'du ma',
  'du me',
  'vai lon',
  'vai cac',
  'con di',
  'con lon',
  'thang lon',
  'fuck you',
];

function stripVietnameseDiacritics(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export function formatProperName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function validateCandidateName(rawInput: string): NameValidationResult {
  const trimmed = rawInput.trim();
  const compactSpaces = trimmed.replace(/\s+/g, ' ');
  const words = compactSpaces ? compactSpaces.split(' ') : [];
  const lettersOnly = compactSpaces.replace(/\s+/g, '');
  const letterCount = Array.from(lettersOnly).length;
  const wordCount = words.length;

  if (!trimmed) {
    return {
      isValid: false,
      normalizedName: '',
      letterCount: 0,
      wordCount: 0,
      errorMessage: null,
      rules: {
        noLeadingNumberOrSymbol: false,
        onlyValidLetters: false,
        minFiveLettersAndProperWords: false,
        respectfulLanguage: true,
      },
    };
  }

  // Rule 1: Cannot start with a number, sign, punctuation, or special symbol (check rawInput and trimmed)
  const firstRawChar = rawInput.charAt(0);
  const firstTrimmedChar = trimmed.charAt(0);
  const noLeadingNumberOrSymbol =
    /^\p{L}/u.test(firstTrimmedChar) && !/^[0-9\p{P}\p{S}]/u.test(firstRawChar);

  // Rule 2: Only valid Unicode letters and spaces (no digits, no special characters anywhere)
  const onlyValidLetters = /^[\p{L}\s]+$/u.test(trimmed);

  // Rule 3: Respectful language (no profanity, vulgarity, insults, or troll tokens)
  const lowerAccentedWords = words.map((w) => w.toLowerCase());
  const unaccentedFull = stripVietnameseDiacritics(compactSpaces);
  const unaccentedWords = unaccentedFull.split(' ').filter(Boolean);

  let respectfulLanguage = true;
  for (const w of lowerAccentedWords) {
    if (ACCENTED_BANNED_WORDS.has(w)) {
      respectfulLanguage = false;
      break;
    }
  }
  if (respectfulLanguage) {
    for (const w of unaccentedWords) {
      if (UNACCENTED_BANNED_WORDS.has(w)) {
        respectfulLanguage = false;
        break;
      }
    }
  }
  if (respectfulLanguage) {
    for (const phrase of BANNED_PHRASES_UNACCENTED) {
      if (
        unaccentedFull === phrase ||
        unaccentedFull.startsWith(`${phrase} `) ||
        unaccentedFull.endsWith(` ${phrase}`) ||
        unaccentedFull.includes(` ${phrase} `)
      ) {
        respectfulLanguage = false;
        break;
      }
    }
  }

  // Rule 4: At least 5 letters, at least 2 words (Họ & Tên), each word has vowels and no gibberish
  let properWordStructure = wordCount >= 2 && wordCount <= 7 && letterCount >= 5;
  if (properWordStructure) {
    for (const w of words) {
      const wChars = Array.from(w);
      // Each word in a proper full name must be 1..10 letters, contain a vowel, and not have 3 identical letters in a row
      if (wChars.length < 1 || wChars.length > 10) {
        properWordStructure = false;
        break;
      }
      if (!VIETNAMESE_VOWEL_REGEX.test(w)) {
        properWordStructure = false;
        break;
      }
      if (/(.)\1\1/i.test(w)) {
        properWordStructure = false;
        break;
      }
    }
    // At least two words must have >= 2 letters (avoid "A B C D E")
    const substantialWords = words.filter((w) => Array.from(w).length >= 2);
    if (substantialWords.length < 2) {
      properWordStructure = false;
    }
    // Reject duplicate identical adjacent words like "Nguyễn Nguyễn"
    for (let i = 1; i < unaccentedWords.length; i++) {
      if (unaccentedWords[i] === unaccentedWords[i - 1] && lowerAccentedWords[i] === lowerAccentedWords[i - 1]) {
        properWordStructure = false;
        break;
      }
    }
  }

  const minFiveLettersAndProperWords =
    onlyValidLetters && letterCount >= 5 && properWordStructure;

  let errorMessage: string | null = null;
  if (!noLeadingNumberOrSymbol) {
    errorMessage = 'Họ và tên không được bắt đầu bằng chữ số, dấu hoặc ký tự đặc biệt.';
  } else if (!onlyValidLetters) {
    errorMessage = 'Họ và tên chỉ được chứa chữ cái, không dùng số hoặc ký tự đặc biệt.';
  } else if (!respectfulLanguage) {
    errorMessage = 'Tên chứa từ ngữ không phù hợp, tục tĩu hoặc không nghiêm túc.';
  } else if (letterCount < 5) {
    errorMessage = `Họ và tên cần tối thiểu 5 chữ cái (hiện có ${letterCount}/5 chữ cái).`;
  } else if (wordCount < 2) {
    errorMessage = 'Vui lòng nhập đầy đủ cả Họ và Tên (tối thiểu 2 từ có nghĩa).';
  } else if (!minFiveLettersAndProperWords) {
    errorMessage = 'Vui lòng nhập Họ và Tên thật, rõ ràng và nghiêm túc.';
  }

  const isValid =
    noLeadingNumberOrSymbol &&
    onlyValidLetters &&
    respectfulLanguage &&
    minFiveLettersAndProperWords;

  return {
    isValid,
    normalizedName: isValid ? formatProperName(compactSpaces) : compactSpaces,
    letterCount,
    wordCount,
    errorMessage,
    rules: {
      noLeadingNumberOrSymbol,
      onlyValidLetters,
      minFiveLettersAndProperWords,
      respectfulLanguage,
    },
  };
}
