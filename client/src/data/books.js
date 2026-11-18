export const categories = ["All", "Novel", "Poetry", "Motivation", "Culture", "Children"];

export const books = [
  { id: "b1", title: { en: "The Quiet Between", gu: "શબ્દોની વચ્ચે", hi: "शब्दों के बीच" }, author: "Mira Desai", language: "English", category: "Novel", price: 249, tone: "rose", badge: "EDITOR'S PICK" },
  { id: "b2", title: { en: "Wings of the Wind", gu: "પવનની પાંખે", hi: "हवा के पंखों पर" }, author: "કાવ્યા ત્રિવેદી", language: "Gujarati", category: "Poetry", price: 180, tone: "sage", badge: "NEW ARRIVAL" },
  { id: "b3", title: { en: "The Art of Enough", gu: "પૂરતું હોવાની કળા", hi: "पर्याप्त होने की कला" }, author: "Arjun Mehta", language: "English", category: "Motivation", price: 320, tone: "ochre", badge: "TRENDING" },
  { id: "b4", title: { en: "The City and I", gu: "શહેર અને હું", hi: "शहर और मैं" }, author: "નિધિ શાહ", language: "Gujarati", category: "Culture", price: 210, tone: "blue", badge: "NEW ARRIVAL" },
  { id: "b5", title: { en: "A Map of Small Things", gu: "નાની વાતોનો નકશો", hi: "छोटी बातों का नक्शा" }, author: "Devika Rao", language: "English", category: "Novel", price: 275, tone: "plum", badge: "POPULAR" },
  { id: "b6", title: { en: "Light of the Heart", gu: "મનની રોશની", hi: "मन की रोशनी" }, author: "अनया शर्मा", language: "Hindi", category: "Poetry", price: 195, tone: "sun", badge: "NEW ARRIVAL" },
];

export function getBookTitle(book, language) {
  return book.title[language] || book.title.en;
}
