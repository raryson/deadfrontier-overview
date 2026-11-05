// Shared, public item definitions only. No account data belongs in this model.
(() => {
  const presets = Object.freeze([
    ['whiskey','Whiskey','supply'], ['nerotonin8b','Nerotonin 8B','supply'],
    ['energybar','Energy Bar','supply'], ['repairkit','Repair Kit','supply'],
    ['14rifleammo','14mm Rifle Bullets','ammo'], ['127rifleammo','12.7mm Rifle Bullets','ammo'],
    ['35ammo','9mm Handgun Bullets','ammo'], ['55rifleammo','5.5mm Rifle Bullets','ammo'],
    ['biomassammo','Biomass','ammo'], ['energycellammo','Energy Cell','ammo'],
    ['grenadeammo','Grenades','ammo'], ['heavygrenadeammo','Heavy Grenades','ammo'],
    ['fuelammo','Gasoline','ammo'], ['10gaugeammo','10 Gauge Shells','ammo'],
    ['12gaugeammo','12 Gauge Shells','ammo'], ['16gaugeammo','16 Gauge Shells','ammo'],
    ['20gaugeammo','20 Gauge Shells','ammo']
  ].map(([id,name,group]) => Object.freeze({id,name,group})));
  function definition(id, catalog) {
    const preset = presets.find(item => item.id === id), data = catalog?.[id];
    if (!preset || !data) return null;
    const quantity = preset.group === 'ammo' ? Number(data.max_quantity) : 1;
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000) return null;
    return {...preset, quantity};
  }
  function selectOffer(params, item, zone, account) {
    const countText=params.get('tradelist_maxresults');
    if(!/^\d{1,3}$/.test(countText??''))throw Error('invalidResponse');
    const count = Number(countText);
    if (!Number.isSafeInteger(count) || count < 0 || count > 500) throw Error('invalidResponse');
    const offers = [];
    for (let i=0; i<count; i++) {
      const get = field => params.get(`tradelist_${i}_${field}`);
      if (get('item') !== item.id || get('trade_zone') !== String(zone) || get('id_member') === String(account)) continue;
      if (!/^\d+$/.test(get('price') ?? '') || !/^\d+$/.test(get('trade_id') ?? '')) continue;
      const quantity = Number(get('quantity')), price = Number(get('price'));
      if (quantity !== item.quantity || !Number.isSafeInteger(price) || price < 0) continue;
      offers.push({tradeId:get('trade_id'), price, quantity});
    }
    return offers.sort((a,b) => a.price-b.price)[0] ?? null;
  }
  globalThis.DFOverviewQuick = Object.freeze({presets, definition, selectOffer});
})();
