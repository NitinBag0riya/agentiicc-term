
import * as HL from 'hyperliquid';

console.log('Hyperliquid Module Exports:', Object.keys(HL));
// @ts-ignore
const { Hyperliquid } = HL;

/* ... existing code commented out or removed ... */
const privateKey = '0x1000000000000000000000000000000000000000000000000000000000000000'; // Dummy
const sdk = new Hyperliquid(privateKey, false);

const getAllProperties = (obj: any) => {
  let allProps: string[] = [];
  let curr = obj;
  do {
    const props = Object.getOwnPropertyNames(curr);
    props.forEach((prop) => {
      if (allProps.indexOf(prop) === -1) {
        allProps.push(prop);
      }
    });
  } while ((curr = Object.getPrototypeOf(curr)) && curr !== Object.prototype);
  return allProps;
}

(async () => {
    try {
        await sdk.connect();
        console.log('--- SDK EXCHANGE INSPECTION ---');
        console.dir(sdk.exchange, { depth: 1, showHidden: true, colors: true });

        // Force check for placeOrder
        console.log('Check keys:', Object.keys(sdk.exchange));
        console.log('Proto keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(sdk.exchange)));
        
        console.log('--- SDK CUSTOM INSPECTION ---');
        console.dir(sdk.custom, { depth: 1, showHidden: true, colors: true });

    } catch (e) {
        console.error(e);
    }
})();
