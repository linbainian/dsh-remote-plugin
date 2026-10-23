export const BEGIN = '# BEGIN dsh-remote-aliyun-step1';
export const END = '# END dsh-remote-aliyun-step1';

export function removeManagedPatch(original) {
  const begin = original.indexOf(BEGIN), end = original.indexOf(END);
  if (begin === -1 && end === -1) return original;
  if (begin === -1 || end < begin || original.indexOf(BEGIN, begin + BEGIN.length) !== -1 || original.indexOf(END, end + END.length) !== -1) throw new Error('Ambiguous managed block; refusing to modify the profile');
  const lineStart = original.lastIndexOf('\n', begin - 1) + 1;
  if (lineStart !== begin) throw new Error('Managed marker is not at a line boundary');
  let start = begin;
  if (start > 0 && original[start - 1] === '\n') start -= original[start - 2] === '\r' ? 2 : 1;
  let stop = end + END.length;
  if (original.slice(stop, stop + 2) === '\r\n') stop += 2;
  else if (original[stop] === '\n') stop++;
  else if (stop !== original.length) throw new Error('Managed end marker is not at a line boundary');
  return original.slice(0, start) + original.slice(stop);
}

export function addManagedPatch(original, moduleUrl, config) {
  const base = removeManagedPatch(original);
  const eol = base.includes('\r\n') ? '\r\n' : '\n';
  const lines = [BEGIN, '- insert:', '    - id: dsh-remote-aliyun-step1', `      name: ${JSON.stringify(moduleUrl)}`, '      config:',
    ...Object.entries(config).map(([key, value]) => `        ${key}: ${JSON.stringify(value)}`), END, ''];
  return base + eol + lines.join(eol);
}
