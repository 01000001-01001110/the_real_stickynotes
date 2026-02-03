/**
 * Note color themes
 */
const colors = {
  yellow: {
    id: 'yellow',
    name: 'Sunny',
    bg: '#FFF9C4',
    title: '#FFEE58',
    hover: '#FDD835',
    text: '#3E2723',
    border: '#FFD54F',
  },
  pink: {
    id: 'pink',
    name: 'Rose',
    bg: '#FCE4EC',
    title: '#F48FB1',
    hover: '#EC407A',
    text: '#880E4F',
    border: '#F8BBD0',
  },
  blue: {
    id: 'blue',
    name: 'Sky',
    bg: '#E3F2FD',
    title: '#64B5F6',
    hover: '#2196F3',
    text: '#0D47A1',
    border: '#90CAF9',
  },
  green: {
    id: 'green',
    name: 'Mint',
    bg: '#E8F5E9',
    title: '#81C784',
    hover: '#4CAF50',
    text: '#1B5E20',
    border: '#A5D6A7',
  },
  purple: {
    id: 'purple',
    name: 'Lavender',
    bg: '#F3E5F5',
    title: '#BA68C8',
    hover: '#9C27B0',
    text: '#4A148C',
    border: '#CE93D8',
  },
  orange: {
    id: 'orange',
    name: 'Sunset',
    bg: '#FFF3E0',
    title: '#FFB74D',
    hover: '#FF9800',
    text: '#E65100',
    border: '#FFCC80',
  },
  gray: {
    id: 'gray',
    name: 'Slate',
    bg: '#ECEFF1',
    title: '#90A4AE',
    hover: '#607D8B',
    text: '#263238',
    border: '#B0BEC5',
  },
  charcoal: {
    id: 'charcoal',
    name: 'Night',
    bg: '#37474F',
    title: '#263238',
    hover: '#1C313A',
    text: '#ECEFF1',
    border: '#455A64',
  },
};

const colorList = Object.keys(colors);

function getColor(colorId) {
  return colors[colorId] || colors.yellow;
}

function isValidColor(colorId) {
  return colorId in colors;
}

module.exports = {
  colors,
  colorList,
  getColor,
  isValidColor,
};
