export const pick = a => a[Math.floor(Math.random()*a.length)];
export const chance = p => Math.random() < p;
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const store = {
  get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } },
  set(k, v){ try { localStorage.setItem(k, v); } catch(e){} }
};
