export const categoryDefinitions = [
  { key: "Novel", labels: { en: "Novel", gu: "નવલકથા", hi: "उपन्यास" }, sortOrder: 10 },
  { key: "Poetry", labels: { en: "Poetry", gu: "કવિતા", hi: "कविता" }, sortOrder: 20 },
  { key: "Motivation", labels: { en: "Motivation", gu: "પ્રેરણા", hi: "प्रेरणा" }, sortOrder: 30 },
  { key: "Culture", labels: { en: "Culture", gu: "સંસ્કૃતિ", hi: "संस्कृति" }, sortOrder: 40 },
  { key: "Children", labels: { en: "Children", gu: "બાળસાહિત્ય", hi: "बाल साहित्य" }, sortOrder: 50 },
];

export const categories = ["All", ...categoryDefinitions.map(({ key }) => key)];

export const books = [
  { id: "b1", title: { en: "The Quiet Between", gu: "શબ્દોની વચ્ચે", hi: "शब्दों के बीच" }, author: "Mira Desai", language: "English", category: "Novel", price: 249, tone: "rose", badge: "EDITOR'S PICK", description: { en: "A tender story about finding home in unexpected places.", gu: "અજાણી જગ્યાઓમાં પોતાનું ઘર શોધવાની હૂંફાળી વાર્તા.", hi: "अनजानी जगहों में अपना घर खोजने की एक कोमल कहानी।" } },
  { id: "b2", title: { en: "Wings of the Wind", gu: "પવનની પાંખે", hi: "हवा के पंखों पर" }, author: "કાવ્યા ત્રિવેદી", language: "Gujarati", category: "Poetry", price: 180, tone: "sage", badge: "NEW ARRIVAL", description: { en: "Poems born from small moments, quiet courage and changing seasons.", gu: "નાની ક્ષણો, શાંત હિંમત અને બદલાતી ઋતુઓમાંથી જન્મેલી કવિતાઓ.", hi: "छोटे पलों, शांत साहस और बदलते मौसमों से जन्मी कविताएँ।" } },
  { id: "b3", title: { en: "The Art of Enough", gu: "પૂરતું હોવાની કળા", hi: "पर्याप्त होने की कला" }, author: "Arjun Mehta", language: "English", category: "Motivation", price: 320, tone: "ochre", badge: "TRENDING", description: { en: "Simple reflections for a life with more room to breathe.", gu: "વધુ નિરાંતભર્યા જીવન માટેના સરળ વિચારો.", hi: "ज़्यादा सुकून भरी ज़िंदगी के लिए सरल विचार।" } },
  { id: "b4", title: { en: "The City and I", gu: "શહેર અને હું", hi: "शहर और मैं" }, author: "નિધિ શાહ", language: "Gujarati", category: "Culture", price: 210, tone: "blue", badge: "NEW ARRIVAL", description: { en: "A search for identity through the lanes and memories of one city.", gu: "એક શહેરની ગલીઓ અને યાદોમાં પોતાની ઓળખની શોધ.", hi: "एक शहर की गलियों और यादों के बीच अपनी पहचान की तलाश।" } },
  { id: "b5", title: { en: "A Map of Small Things", gu: "નાની વાતોનો નકશો", hi: "छोटी बातों का नक्शा" }, author: "Devika Rao", language: "English", category: "Novel", price: 275, tone: "plum", badge: "POPULAR", description: { en: "A family, a forgotten recipe and the stories that bind them.", gu: "એક પરિવાર, ભૂલાઈ ગયેલી વાનગી અને તેમને જોડતી વાર્તાઓ.", hi: "एक परिवार, भूली हुई रेसिपी और उन्हें जोड़ती कहानियाँ।" } },
  { id: "b6", title: { en: "Light of the Heart", gu: "મનની રોશની", hi: "मन की रोशनी" }, author: "अनया शर्मा", language: "Hindi", category: "Poetry", price: 195, tone: "sun", badge: "NEW ARRIVAL", description: { en: "Honest poems that give voice to the heart's quiet thoughts.", gu: "મનની શાંત લાગણીઓને અવાજ આપતી સાચી કવિતાઓ.", hi: "मन की खामोशियों को आवाज़ देती सच्ची कविताएँ।" } },
];

export function getBookTitle(book, language) {
  return book.title[language] || book.title.en;
}
