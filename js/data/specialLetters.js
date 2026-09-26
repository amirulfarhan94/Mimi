// Mimi Love Letter — special dates. These override the normal daily letter.
// Source: Mimi_365_Love_Letters_Final_Review.xlsx (sheet "Special Dates").
//
// Each occasion can hold several messages: add more objects to `messages`.
// The popup shows one of them per year (rotating).
// `signature: null` shows no "— Hubby" sign-off.

export const SPECIAL_DATES = [
  {
    id: "mimi-birthday", month: 4, day: 2, occasion: "Mimi Birthday",
    emoji: "🎂", theme: "birthday", title: "Happy Birthday, Sayang ❤️",
    cardTitle: "A Birthday Letter",
    cardSubtitle: "Today is all about you… open it ✨",
    messages: [
      { signature: "Hubby", text: "Happy Birthday, Sayang. ❤️\n\nToday is the day I get to celebrate you—not just as my wife, but as the person who has shared so many chapters of my life with me. Thank you for everything you do for me and our family, and for all the love you give in ways big and small.\n\nI hope this new year of your life brings you happiness, peace, good health and everything your heart wishes for.\n\nI hope you always know how deeply you are loved.\n\nHappy Birthday, my Sayang. ❤️" },
    ],
  },
  {
    id: "hubby-birthday", month: 10, day: 10, occasion: "Hubby Birthday",
    emoji: "🎂", theme: "birthday", title: "Someone's Birthday Today! ❤️",
    cardTitle: "Someone's Birthday!",
    cardSubtitle: "There’s a little note about it… 🎈",
    messages: [
      { signature: null, text: "Hey Sayang… someone is getting older today. 😂🎂\n\nHappy Birthday to my favourite husband! ❤️\n\nThank you for being the person you are, for everything you do for me and our family, and for all the memories we've made together. I hope this year brings you happiness, success, good health and many more reasons to smile.\n\nAnd yes… you're getting older, but don't worry. You're still my favourite. 😘\n\nHappy Birthday, Hubby. ❤️" },
    ],
  },
  {
    id: "anniversary", month: 11, day: 30, occasion: "Anniversary",
    emoji: "💍", theme: "anniversary", title: "Happy Anniversary, Sayang ❤️",
    cardTitle: "An Anniversary Letter",
    cardSubtitle: "Something special is waiting… 💕",
    messages: [
      { signature: "Hubby", text: "Happy Anniversary, Sayang. ❤️\n\nAnother year of us. Another year of memories, laughter, challenges, little arguments, silly moments and everything in between.\n\nLife with you isn't always perfect, but it's the life I choose—and the person I want beside me through all of it is still you.\n\nThank you for walking this journey with me. Here's to everything we've written together and all the chapters still waiting for us.\n\nI love you. Always. ❤️" },
    ],
  },
];
