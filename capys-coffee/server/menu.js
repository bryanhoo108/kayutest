// Seed menu for Capy's Coffee. Prices are in sen (RM 1 = 100 sen).
// Loaded into the database only on first start; after that the menu is edited
// from Staff → Menu and lives in the database.

export const OPTION_GROUPS = [
  {
    id: 'ice',
    name: 'Ice level',
    name_zh: '冰量',
    default: 'normal',
    choices: [
      { id: 'normal', name: 'Normal ice', name_zh: '正常冰' },
      { id: 'less', name: 'Less ice', name_zh: '少冰' },
      { id: 'none', name: 'No ice', name_zh: '去冰' },
    ],
  },
  {
    id: 'sugar',
    name: 'Sweetness',
    name_zh: '甜度',
    default: 'normal',
    choices: [
      { id: 'normal', name: 'Normal sweet', name_zh: '正常甜' },
      { id: 'less', name: 'Less sweet', name_zh: '少甜' },
      { id: 'none', name: 'No sugar', name_zh: '无糖' },
    ],
  },
];

export const CATEGORIES = [
  { id: 'signature', name: 'Signature', name_zh: '招牌特饮', sort: 1 },
  { id: 'americano', name: 'Iced Americano', name_zh: '冰美式', sort: 2 },
  { id: 'latte', name: 'Iced Latte', name_zh: '冰拿铁', sort: 3 },
];

// `art` drives the illustrated cup in the app (web/src/components/DrinkArt.jsx).
export const ITEMS = [
  {
    id: 'blue-sea-goldfish-soda', category_id: 'signature', number: null, featured: 1,
    name: 'Blue Sea Goldfish Soda', name_zh: '深海捞金',
    tagline: 'Ocean blue & sparkling', tagline_zh: '深海蓝 · 气泡清爽',
    description: 'Sparkling ocean-blue soda over ice with little goldfish swimming inside. Our signature beach sipper.',
    description_zh: '冰爽深海蓝气泡水，金鱼在杯中畅游，海边必点招牌。',
    price: 1000,
    art: { tint: '#DCEEFF', layers: [{ c: '#1C64D6', h: 0.32 }, { c: '#7FB6F2', h: 0.18 }, { c: '#E6F2FF', h: 0.38 }], garnish: 'goldfish', bubbles: true },
  },
  {
    id: 'classic-iced-americano', category_id: 'americano', number: 1, featured: 0,
    name: 'Classic Iced Americano', name_zh: '经典冰美式',
    tagline: 'Classic', tagline_zh: '经典',
    description: 'Pure and bold, crisp and refreshing.', description_zh: '纯粹咖啡香，清爽回甘。',
    price: 600,
    art: { tint: '#EFE6DC', layers: [{ c: '#2A1810', h: 0.86 }], garnish: 'beans' },
  },
  {
    id: 'grapefruit-iced-americano', category_id: 'americano', number: 2, featured: 0,
    name: 'Grapefruit Iced Americano', name_zh: '柚见冰美式',
    tagline: 'Fresh & Fruity', tagline_zh: '清新果香',
    description: 'Citrusy and vibrant, a refreshing boost.', description_zh: '柚香清新，咖啡更出彩。',
    price: 800,
    art: { tint: '#FCE4DC', layers: [{ c: '#E9775F', h: 0.36 }, { c: '#3A2016', h: 0.5 }], garnish: 'grapefruit' },
  },
  {
    id: 'orange-iced-americano', category_id: 'americano', number: 3, featured: 0,
    name: 'Orange Iced Americano', name_zh: '橙C冰美式',
    tagline: 'Bright & Citrusy', tagline_zh: '明亮柑橘',
    description: 'Full of vitamin C, sweet and refreshing.', description_zh: '满满维C，酸甜清爽。',
    price: 800,
    art: { tint: '#FDEBD2', layers: [{ c: '#F59E1B', h: 0.5 }, { c: '#3A2016', h: 0.36 }], garnish: 'orange' },
  },
  {
    id: 'cola-iced-americano', category_id: 'americano', number: 4, featured: 0,
    name: 'Cola Iced Americano', name_zh: '可乐冰美式',
    tagline: 'Sweet & Fizzy', tagline_zh: '甜蜜气泡',
    description: 'Fizzy and bold, a unique coffee twist.', description_zh: '气泡劲爽，咖啡新体验。',
    price: 800,
    art: { tint: '#EDE7E1', layers: [{ c: '#6B3A22', h: 0.4 }, { c: '#2A1810', h: 0.46 }], garnish: 'lime', bubbles: true },
  },
  {
    id: 'quicksand-iced-americano', category_id: 'americano', number: 5, featured: 0,
    name: 'Quicksand Iced Americano', name_zh: '流沙冰美式',
    tagline: 'Creamy & Smooth', tagline_zh: '绵密顺滑',
    description: 'Velvety smooth, rich and indulgent.', description_zh: '绵密流沙口感，顺滑香浓。',
    price: 800,
    art: { tint: '#F3E7DA', layers: [{ c: '#5B3522', h: 0.58 }, { c: '#C99A6B', h: 0.28 }], garnish: 'foam', noIce: true },
  },
  {
    id: 'brickmovers-iced-latte', category_id: 'latte', number: 6, featured: 0,
    name: "Brickmover's Iced Latte", name_zh: '搬砖冰拿铁',
    tagline: 'Strong & Energizing', tagline_zh: '元气满满',
    description: 'Fuel your grind, power up your day.', description_zh: '元气满满，为努力加油。',
    price: 800,
    art: { tint: '#EFE7DE', layers: [{ c: '#F3ECE2', h: 0.46 }, { c: '#6B4430', h: 0.4 }], garnish: 'beans' },
  },
  {
    id: 'raw-coconut-iced-latte', category_id: 'latte', number: 7, featured: 0,
    name: 'Raw Coconut Iced Latte', name_zh: '生椰冰拿铁',
    tagline: 'Tropical & Natural', tagline_zh: '热带天然',
    description: 'Coconut freshness, naturally delicious.', description_zh: '生椰清甜，天然好滋味。',
    price: 1000,
    art: { tint: '#EEF3EA', layers: [{ c: '#FBF8F1', h: 0.5 }, { c: '#7A4E36', h: 0.36 }], garnish: 'coconut' },
  },
  {
    id: 'wheatgrass-iced-latte', category_id: 'latte', number: 8, featured: 0,
    name: 'Wheatgrass Iced Latte', name_zh: '小麦冰拿铁',
    tagline: 'Healthy & Refreshing', tagline_zh: '健康清爽',
    description: 'Green goodness, light and refreshing.', description_zh: '清新小麦草，轻盈好选择。',
    price: 1000,
    art: { tint: '#E9F1DE', layers: [{ c: '#6FA23C', h: 0.3 }, { c: '#F1ECE0', h: 0.22 }, { c: '#7A4E36', h: 0.34 }], garnish: 'wheat' },
  },
  {
    id: 'strawberry-iced-latte', category_id: 'latte', number: 9, featured: 0,
    name: 'Strawberry Iced Latte', name_zh: '莓烦恼',
    tagline: 'Sweet & Berry', tagline_zh: '香甜莓果',
    description: 'Sweet strawberry, good vibes only.', description_zh: '草莓香甜，心情更美丽。',
    price: 1000,
    art: { tint: '#FBE3E7', layers: [{ c: '#EE9AAA', h: 0.48 }, { c: '#7A4E36', h: 0.38 }], garnish: 'strawberry' },
  },
  {
    id: 'mocha-iced-latte', category_id: 'latte', number: 10, featured: 0,
    name: 'Mocha Iced Latte', name_zh: '摩卡冰拿铁',
    tagline: 'Chocolate Lover', tagline_zh: '巧克力控',
    description: 'The perfect blend of chocolate and coffee.', description_zh: '巧克力与咖啡的完美邂逅。',
    price: 1000,
    art: { tint: '#EFE3DA', layers: [{ c: '#3E2216', h: 0.26 }, { c: '#EFE6DA', h: 0.26 }, { c: '#6B4430', h: 0.34 }], garnish: 'chocolate', drizzle: true },
  },
  {
    id: 'oat-iced-latte', category_id: 'latte', number: 11, featured: 0,
    name: 'Oat Iced Latte', name_zh: '燕麦冰拿铁',
    tagline: 'Nutty & Smooth', tagline_zh: '坚果香 · 顺滑',
    description: 'Oat goodness, smooth and comforting.', description_zh: '燕麦香浓，温和顺口。',
    price: 1000,
    art: { tint: '#F4ECDD', layers: [{ c: '#E8D6B8', h: 0.5 }, { c: '#8A5A3C', h: 0.36 }], garnish: 'oat' },
  },
];
