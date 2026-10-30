// Dados selecionados, não um inventário completo. Conferir o tooltip do jogo.
export const source = 'https://deadfrontier.fandom.com/wiki/Drugs';
export const effects = { exp: 'EXP +50%', damage: 'Dano +35%', speed: 'Velocidade +35%', exp_ex: 'EXP EX +50%', damage_ex: 'Dano EX +35%', speed_ex: 'Velocidade EX +35%' };
const item = (id, name, minutes, channels) => ({ id, name, minutes, channels });
export const catalog = [
  item('pamphlet', 'Outbreak Pamphlet', 3, ['exp']),
  item('vitamins', 'Multivitamins', 3, ['damage']),
  item('soda', 'Soda', 3, ['speed']),
  item('handbook', 'Survival Handbook', 6, ['exp']),
  item('supplements', 'Supplements', 6, ['damage']),
  item('coffee', 'Coffee', 6, ['speed']),
  item('manual', 'Combat Training Manual', 9, ['exp']),
  item('inhaler', 'Inhaler', 9, ['damage']),
  item('drink', 'Energy Drink', 9, ['speed']),
  item('notes', 'Secronom Research Notes', 15, ['exp']),
  item('serum', 'Experimental Serum', 15, ['damage']),
  item('bar', 'Energy Bar', 15, ['speed']),
  item('cognitive', 'Cognitive Stimulants', 15, ['exp', 'speed']),
  item('adrenaline', 'Adrenaline', 15, ['damage', 'speed']),
  item('herbs', 'Fresh Herbs', 30, ['exp']),
  item('grounds', 'Fresh Coffee Grounds', 30, ['speed']),
  ...['exp', 'damage', 'speed'].flatMap(channel => [
    item(`mini-${channel}`, `Mini ${channel === 'exp' ? 'EXP' : channel === 'damage' ? 'Damage' : 'Speed'} Boost`, 120, [channel]),
    item(`day-${channel}`, `${channel === 'exp' ? 'EXP' : channel === 'damage' ? 'Damage' : 'Speed'} Boost`, 1440, [channel])
  ]),
  item('mini-trinity', 'Mini Trinity Boost', 120, ['exp', 'damage', 'speed']),
  item('trinity', 'Trinity Boost', 1440, ['exp', 'damage', 'speed'])
];
