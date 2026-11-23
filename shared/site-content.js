import { DEFAULT_AUTHOR_UPLOAD_LIMITS_MB } from "./author-upload-limits.js";

export const defaultSiteContent = {
  platform: { defaultLanguage: "en", siteName: "Rasbhav Books" },
  uploads: { coverMaxMb: DEFAULT_AUTHOR_UPLOAD_LIMITS_MB.cover, manuscriptMaxMb: DEFAULT_AUTHOR_UPLOAD_LIMITS_MB.manuscript },
  maintenance: {
    enabled: false,
    message: {
      en: "We are making a few improvements. Please check back soon.",
      gu: "અમે કેટલીક સુધારાઓ કરી રહ્યા છીએ. કૃપા કરીને થોડી વાર પછી ફરી આવો.",
      hi: "हम कुछ सुधार कर रहे हैं। कृपया थोड़ी देर बाद फिर आएँ।",
    },
  },
  announcement: {
    enabled: false,
    text: { en: "", gu: "", hi: "" },
    linkLabel: { en: "", gu: "", hi: "" },
    href: "",
  },
  navigation: [
    { enabled: true, href: "/#discover", label: { en: "Discover", gu: "શોધો", hi: "खोजें" } },
    { enabled: true, href: "/#authors", label: { en: "For authors", gu: "લેખકો માટે", hi: "लेखकों के लिए" } },
    { enabled: true, href: "/#about", label: { en: "Our story", gu: "અમારી વાત", hi: "हमारी कहानी" } },
  ],
  footer: {
    tagline: {
      en: "Made for stories and the people who tell them.",
      gu: "વાર્તાઓ અને વાર્તાકારો માટે બનાવેલું.",
      hi: "कहानियों और उन्हें कहने वालों के लिए।",
    },
    browseLinks: [
      { enabled: true, href: "/#discover", label: { en: "Discover", gu: "શોધો", hi: "खोजें" } },
      { enabled: true, href: "/#categories", label: { en: "Novel", gu: "નવલકથા", hi: "उपन्यास" } },
      { enabled: true, href: "/#authors", label: { en: "For authors", gu: "લેખકો માટે", hi: "लेखकों के लिए" } },
    ],
    communityTitle: { en: "Community", gu: "સમુદાય", hi: "समुदाय" },
    communityLinks: [
      { enabled: true, href: "/#about", label: { en: "Our story", gu: "અમારી વાત", hi: "हमारी कहानी" } },
      { enabled: true, href: "/author/apply", label: { en: "Write with us", gu: "અમારી સાથે લખો", hi: "हमारे साथ लिखें" } },
      { enabled: true, href: "/blog", label: { en: "Stories", gu: "લેખો", hi: "लेख" } },
    ],
  },
  homepage: {
    sections: [
      { id: "hero", enabled: true },
      { id: "trust", enabled: true },
      { id: "discovery", enabled: true },
      { id: "featured", enabled: false },
      { id: "languages", enabled: true },
      { id: "authors", enabled: true },
      { id: "community", enabled: true },
    ],
    featuredBookIds: [],
    seo: {
      title: {
        en: "Rasbhav Books — Every book has a soul",
        gu: "રसभવ બુક્સ — દરેક પુસ્તકમાં એક આત્મા છે",
        hi: "रसभव बुक्स — हर किताब में एक आत्मा है",
      },
      description: {
        en: "Discover Indian stories and independent authors at Rasbhav Books.",
        gu: "રसभવ બુક્સ પર ભારતીય વાર્તાઓ અને સ્વતંત્ર લેખકોને શોધો.",
        hi: "रसभव बुक्स पर भारतीय कहानियाँ और स्वतंत्र लेखक खोजें।",
      },
    },
    hero: {
      eyebrow: {
        en: "Stories rooted in India, shared with the world",
        gu: "ભારતની માટીમાંથી ઊગેલી, દુનિયા સુધી પહોંચતી વાર્તાઓ",
        hi: "भारत की मिट्टी से जन्मी, दुनिया तक पहुँचती कहानियाँ",
      },
      title: {
        en: "Every book has a soul.",
        gu: "દરેક પુસ્તકમાં એક આત્મા છે.",
        hi: "हर किताब में एक आत्मा है।",
      },
      description: {
        en: "Find your next favourite read. Meet independent voices writing in Gujarati, Hindi and English.",
        gu: "તમારું મનગમતું પુસ્તક શોધો. ગુજરાતી, હિન્દી અને અંગ્રેજીમાં લખતા સ્વતંત્ર અવાજોને મળો.",
        hi: "अपनी अगली पसंदीदा किताब खोजें। गुजराती, हिंदी और अंग्रेज़ी की स्वतंत्र आवाज़ों से मिलें।",
      },
      primaryCta: {
        en: "Explore books",
        gu: "પુસ્તકો જુઓ",
        hi: "किताबें देखें",
      },
      secondaryCta: {
        en: "I'm an author",
        gu: "હું લેખક છું",
        hi: "मैं लेखक हूँ",
      },
    },
  },
};
