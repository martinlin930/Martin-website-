export const petHeights={Dog:.78,Cow:1.3,Horse:1.8,Llama:1.5,Pig:.65,Pug:.45,Sheep:.8,Zebra:1.65};
export function mountScale(kind){return petHeights[kind]?Math.max(1,1.2/petHeights[kind]):1;}
export function mountSeat(kind){return (petHeights[kind]||0)*mountScale(kind)*.72;}
