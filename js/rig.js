// What the director needs to know of a body (js/direct.js is shared with Paper Puppets): its height and its kind.
export const bodyOf = (spec) => { const kind = spec.age || 'adult', H = kind === 'kid' ? 1.39 : 1.55; return { H, kind, leg: kind === 'kid' ? 0.3 : 0.46 }; };
