/* ------------------------------------------------------------------
   Everything the tree can say.

   Each ornament is named after one of her songs and the lines
   underneath are written to that song's weather — the scarf left in
   October, the borrowed cardigan, the glitter nobody sweeps up — but
   the words are ours, not hers. Nothing here quotes a lyric.

   Edit freely: this is the only file you need to touch to change
   what the tree tells her.

   To use your own photographs, drop files into ./photos/ and set
   `photo: './photos/your-file.jpg'` on any present or ornament below.
   Anything without a photo gets a hand-drawn frosted plate instead.
   ------------------------------------------------------------------ */

export const ORNAMENT_MEMORIES = [
  { kicker: 'Enchanted',        title: 'Walking home afterwards',
    body: 'I replayed that entire first conversation the whole way back, out loud, to nobody. I have been slightly useless ever since and I would like you to know it was your fault.',
    foot: 'The whole way home' },

  { kicker: 'All Too Well',     title: 'The scarf',
    body: 'You left it here in October. It is still on the hook by the door. I have had several clear opportunities to give it back and I have taken exactly none of them.',
    foot: 'It smells like you. Obviously' },

  { kicker: 'Love Story',       title: 'The long way round',
    body: 'Every good one takes its time getting to the part where somebody finally says it out loud. This is me taking my time. This is also me not taking my time at all.',
    foot: 'Say yes' },

  { kicker: 'invisible string', title: 'All the near misses',
    body: 'Every wrong turn, every almost-meeting, every year we were somewhere else — it all turns out to have been a very long way of walking towards this.',
    foot: 'Teal thread, apparently' },

  { kicker: 'Out Of The Woods', title: 'The nervous part',
    body: 'Nobody warns you that the beginning is mostly holding your breath and checking your phone like an idiot. I am told it passes. I am not in a hurry for it to.',
    foot: 'Still holding it' },

  { kicker: 'Delicate',         title: 'Is it too soon for this',
    body: 'Almost certainly. I am saying it inside a Christmas decoration, which is the most deniable place I could think of putting it, so technically I have said nothing.',
    foot: 'Deniable, barely' },

  { kicker: 'You Are In Love',  title: 'Quiet evidence',
    body: 'It is never the big declarations. It is you knowing how I take my coffee, and me noticing that you knew, and then both of us saying nothing about it.',
    foot: 'Small, enormous things' },

  { kicker: 'august',           title: 'The summer I spent hoping',
    body: 'Mostly it was waiting to see whether you would text. It slipped away the way they do, and here we are in December, and I am still here.',
    foot: 'It was a good summer' },

  { kicker: 'willow',           title: 'However you want this to go',
    body: 'You could ask me to stand outside in the cold and look at a tree for an hour and I would be there early, with the good gloves, pretending I had just happened to be passing.',
    foot: 'I am easy to find' },

  { kicker: 'Daylight',         title: 'What changed',
    body: 'I had decided, fairly firmly, that this sort of thing happened to other people. Then you turned up and somebody went and changed the entire colour scheme on me.',
    foot: 'Gold, as it turns out' },

  { kicker: 'Paper Rings',      title: 'Nothing fancy',
    body: 'I like you in the cheap-and-cheerful way and in the serious way at the same time. Paper rings, if that is what is going. I am not fussy about the packaging.',
    foot: 'Only about the person' },

  { kicker: 'New Year’s Day', title: 'Still there in the morning',
    body: 'Anyone will turn up for the party. I would like to be the one left at eight the next morning, holding a bin bag, finding sequins in the carpet for weeks.',
    foot: 'That is the actual offer' },

  { kicker: 'Lavender Haze',    title: 'Nobody else’s business',
    body: 'Let them wonder. I am not interested in explaining this to anyone until it is a thing worth explaining, and even then only to about four people.',
    foot: 'A slow December' },

  { kicker: 'Snow On The Beach', title: 'Statistically unlikely',
    body: 'Two things that should not be happening at the same time, happening anyway, in front of us. I keep checking it is real and it keeps being real.',
    foot: 'It is still snowing' },

  /* --- quietly placed Easter eggs --- */
  { kicker: 'cardigan',         title: 'Found at the back of the wardrobe',
    body: 'Woodsmoke, sleeves far too long, borrowed so many times that neither of us could say now whose it was to begin with. I vote we stop trying to work it out.',
    foot: 'Keep it', easter: true },

  { kicker: 'The Alchemy',      title: 'How this works',
    body: 'Nothing about this ought to turn into gold. It keeps doing it anyway, every single time you reply, which is frankly poor science and excellent news.',
    foot: 'Unrepeatable in a lab', easter: true },

  { kicker: 'Sweet Nothing',    title: 'Nothing much, ideally',
    body: 'Ask me what I actually want and the honest answer is a completely ordinary evening with nothing happening in it, and you in the room.',
    foot: 'That is the whole wish', easter: true },

  { kicker: 'Christmas Tree Farm', title: 'Where this one came from',
    body: 'Built out of pixels and nerve at an hour I am not proud of. There is a real one out there somewhere, and I would quite like to go and argue with you about which shape is best.',
    foot: 'I will drive', easter: true },

  { kicker: 'Thirteen',         title: 'Her lucky number, and now mine',
    body: 'Count them. The thirteenth is always the brightest one on the tree, and it is the one I would take down and put straight into your hands.',
    foot: '13', easter: true },
];

export const WISHES = [
  { kicker: 'Fearless',         title: 'Courage, briefly',
    body: 'May one of us be brave first. I am volunteering, unless anybody objects in the next thirty seconds. Nobody is objecting. Good.' },
  { kicker: 'ivy',              title: 'Something that grows',
    body: 'May this be the patient kind of thing — the kind that takes a whole season, and then holds on through a much worse one.' },
  { kicker: 'Long Live',        title: 'Whatever this becomes',
    body: 'May we end up being the thing our friends are still teasing us about in several years, at a table, loudly.' },
  { kicker: 'Begin Again',      title: 'An ordinary Wednesday',
    body: 'May it keep happening like that — no occasion, no plan, you being easy to talk to in a way I had stopped expecting from anyone.' },
  { kicker: 'King Of My Heart', title: 'The good news',
    body: 'May you find out that the quiet option was the right one all along, and may you find out reasonably soon.' },
  { kicker: 'Today Was A Fairytale', title: 'More days like this one',
    body: 'May we get a long run of them, completely unremarkable to everybody else and quietly undefeated for us.' },
  { kicker: 'peace',            title: 'The honest version',
    body: 'I cannot promise you anything dramatic. I can promise to be steady, and to be glad every single time you walk into the room.' },
  { kicker: 'Everything Has Changed', title: 'One more conversation',
    body: 'May there always be a reason to keep talking well past the point where we should both have gone to sleep.' },
];

export const PRESENTS = [
  { kicker: 'Gift tag · Lover', title: 'The obvious one',
    body: 'Wrapped badly on purpose, so that you would know for certain nobody else had done it for me.',
    foot: 'Open this one last' },

  { kicker: 'Gift tag · Fortnight', title: 'Two weeks of nerve',
    body: 'That is roughly how long this sat unsent in a drafts folder before it turned into an entire Christmas tree. Efficiency was never really the point.',
    foot: 'Worth the wait, I hope' },

  { kicker: 'Gift tag · Wildest Dreams', title: 'Something to keep',
    body: 'Not expensive. Just chosen, properly, which is the part that actually takes the time. Keep it somewhere you will see it.',
    foot: 'Even if this goes nowhere' },

  { kicker: 'Gift tag · Red', title: 'Too much, deliberately',
    body: 'I did consider toning all of this down so as to look relaxed and normal about it. Then I decided not to. You are getting the unedited version.',
    foot: 'No notes taken' },

  { kicker: 'Gift tag · Begin Again', title: 'A promise, boxed',
    body: 'One evening of your choosing, anywhere you like, excuses not accepted. The box itself is mostly ceremonial.',
    foot: 'Redeemable any time' },

  { special: true, kicker: 'The thirteenth gift', title: 'The actual reason for all of this',
    body: 'Everything on this tree is a very long way of saying one short thing: I like you, properly, and I built you a universe so that I would not have to say it out loud. Consider it said.',
    foot: 'Merry Christmas' },
];

export const STAR_MESSAGE = {
  kicker: 'The star',
  title: 'Put the light at the top',
  body: 'Everything else here is decoration. And if you look up, there are twelve more stars out in the sky — one for each of her records. Touch one and the whole tree turns that colour.',
  foot: 'Twelve to find. There may be a thirteenth',
};

export const THIRTEENTH_MESSAGE = {
  kicker: 'The thirteenth star',
  title: 'You found all of them',
  body: 'Twelve records, twelve colours, and you went and looked at every single one. That was the part I was hoping for. So, plainly: I like you — not in the casual way, in the building-you-a-whole-winter-sky way. Whenever you are ready, I would love to go and look at a real tree with you.',
  foot: 'No rush. I am not going anywhere',
  easter: true,
};

export const ABOUT = {
  kicker: 'About',
  title: 'A tree with a whole sky around it',
  body: 'Drag to turn it, scroll or pinch to come closer, and click the ornaments, the gifts and the star. Twelve coloured stars are out in the sky, one for each record — click one and the tree changes into it. Cosmic mode dissolves the same tree into the particles it was always made of, then gathers it back again.',
  foot: 'Space — modes · R — reset · A — auto-rotate · C — colours',
};

/* ------------------------------------------------------------------
   THE PICTURE WALL
   Hold the tree until the light reaches the star and it breaks open
   into this: September to Christmas Day, on a thread.

   Put your photographs in ./photos/ and list them in `photos` below.
   One, two or three per entry — two reads best for a wide card. Any
   entry with no photographs gets a hand-drawn winter plate instead,
   so the wall is never empty while you are still collecting them.
   ------------------------------------------------------------------ */

export const TIMELINE = [
  { month: 'September', date: 'Early September', song: 'august',
    title: 'The first message',
    body: 'Four drafts. Three deletions. One sent at a slightly unhinged hour, and then an entire evening spent not looking at my phone on purpose.',
    photos: [] },

  { month: 'September', date: 'Mid September', song: 'Everything Has Changed',
    title: 'The reply that went on too long',
    body: 'Yours arrived as a paragraph. I read it twice standing up, then once more sitting down, and decided to match the energy exactly.',
    photos: [] },

  { month: 'September', date: 'Late September', song: 'Begin Again',
    title: 'Coffee, and then more coffee',
    body: 'Supposed to be an hour. Became three. The staff started stacking the chairs around us and neither of us took the hint.',
    photos: [] },

  { month: 'October', date: 'Early October', song: 'All Too Well',
    title: 'The scarf',
    body: 'Left on the hook by the door, where it has remained ever since. I have had several clear opportunities to return it and taken none of them.',
    photos: [] },

  { month: 'October', date: 'Late October', song: 'Enchanted',
    title: 'The long way back',
    body: 'We took the route that adds twenty minutes for no reason at all, and then stood at the corner for another ten not ending the conversation.',
    photos: [] },

  { month: 'November', date: 'Early November', song: 'invisible string',
    title: 'The playlist',
    body: 'You sent it without comment. I treated it like evidence and have been quietly reading into the track order ever since.',
    photos: [] },

  { month: 'November', date: 'Mid November', song: 'ivy',
    title: 'First properly cold night',
    body: 'Everything went dark at four in the afternoon and somehow that made the evening better rather than worse. I remember thinking: oh, this is going to be a thing.',
    photos: [] },

  { month: 'November', date: 'Late November', song: 'Red',
    title: 'The argument about which album is best',
    body: 'Unresolved. Likely to remain unresolved. I have privately changed my position twice and will be admitting to neither.',
    photos: [] },

  { month: 'December', date: 'Early December', song: 'Christmas Tree Farm',
    title: 'The lights going up',
    body: 'Half the street did theirs on the same evening. We walked the whole length of it and rated them out of ten, harshly, and then went back for a second look.',
    photos: [] },

  { month: 'December', date: 'Mid December', song: 'Delicate',
    title: 'The one where I almost said it',
    body: 'Got close enough that you probably noticed. Changed the subject to something about trains. Have thought about it most days since.',
    photos: [] },

  { month: 'December', date: '19 December', song: 'Lavender Haze',
    title: 'Nobody else\u2019s business',
    body: 'A whole evening where nothing happened and nobody needed either of us anywhere. The best one so far, by a distance.',
    photos: [] },

  { month: 'December', date: 'Christmas Eve', song: 'New Year\u2019s Day',
    title: 'The night before',
    body: 'Everything quiet, everything ready, the lights left on downstairs because turning them off felt rude.',
    photos: [] },

  { month: 'Christmas Day', date: '25 December', song: 'Daylight',
    title: 'Here',
    body: 'This is the end of the thread and the start of the better bit. I built you a winter so I could say one sentence in it: I like you, and I would like to keep doing this.',
    photos: [], finale: true },
];

export const TIMELINE_INTRO = {
  kicker: 'September \u2014 Christmas Day',
  title: 'The whole run of it',
  hint: 'Drag, scroll or use the arrow keys',
  hintTouch: 'Scroll down to Christmas Day',
};
