export const FIREFOX_ADDON_ID='roll20-embetterment@newnetmp3.github.io';
export const FIREFOX_UPDATE_URL='https://raw.githubusercontent.com/newnetmp3/roll20embetterment/main/extension/firefox/updates.json';
export function createFirefoxUpdates({version,sha256}){
  if(!/^(0|[1-9]\d{0,8})(?:\.(?:0|[1-9]\d{0,8})){1,3}$/.test(version||''))
    throw Error('Invalid Firefox extension version');
  if(!/^[a-f0-9]{64}$/i.test(sha256||''))
    throw Error('Signed Firefox XPI SHA-256 must be 64 hexadecimal digits');
  const file='r20eb-firefox-v'+version+'.xpi';
  const link='https://github.com/newnetmp3/roll20embetterment/releases/download/firefox-v'+version+'/'+file;
  return {addons:{[FIREFOX_ADDON_ID]:{updates:[{
    version,update_link:link,update_hash:'sha256:'+sha256.toLowerCase()
  }]}}};
}
