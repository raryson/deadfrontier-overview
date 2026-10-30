export function assertOcrEnvironment(manifest, bundledVersion) {
  function fail(code) {const error=new Error(code);error.code=code;throw error;}
  if(!manifest || manifest.version!==bundledVersion)fail('ocrReloadRequired');
  const policy=typeof manifest.content_security_policy==='string'?manifest.content_security_policy:manifest.content_security_policy?.extension_pages;
  const directives=new Map(String(policy??'').split(';').map(part=>{
    const [name,...values]=part.trim().split(/\s+/);return [name,values];
  }));
  const scripts=directives.get('script-src')??directives.get('default-src')??[];
  if(!scripts.includes("'wasm-unsafe-eval'"))fail('ocrPolicyMissing');
}
