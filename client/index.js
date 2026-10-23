/* DSH's client module format. React is supplied by the existing desktop UI. */
window.__ModuleLoader__.load({
  id: 'dsh-remote-aliyun',
  factory: require => {
    const React = require('react');
    const h = React.createElement;
    const NS = 'dsh-remote-aliyun';
    const endpoint = 'dsh-remote-aliyun-probe/control';

    const css = `
      .wCInkW_panel:has(.dsh-remote){width:min(1040px,calc(100vw - 48px));max-width:calc(100vw - 32px)}
      .dsh-remote{color:var(--dsw-alias-label-primary,#26282d);font:inherit;font-size:14px;line-height:1.6;padding:16px;container-type:inline-size;max-width:1050px;margin:0 auto}
      .dsh-remote *{box-sizing:border-box}.dsh-remote button,.dsh-remote input{font:inherit}
      .dsh-remote-head{display:flex;gap:12px;align-items:flex-start;margin-bottom:16px}.dsh-remote-head h2{font-size:20px;font-weight:600;margin:0 0 4px}
      .dsh-remote p{margin:0}.dsh-remote-muted{color:var(--dsw-alias-label-secondary,#777b85)}
      .dsh-remote-icon{display:grid;place-items:center;width:40px;height:40px;border:1px solid var(--dsw-alias-border-l2,#e0e2e6);border-radius:10px;flex:none}
      .dsh-remote-grid{display:grid;grid-template-columns:minmax(280px,1.35fr) minmax(210px,1fr);gap:16px;align-items:start}
      .dsh-remote-card{border:1px solid var(--dsw-alias-border-l2,#e0e2e6);border-radius:14px;padding:20px;background:var(--dsw-alias-bg-layer-2,#fff);min-width:0}
      .dsh-remote-card h3{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:500;margin:0 0 5px}
      .dsh-remote-status{margin-top:20px;border-radius:10px;background:var(--dsw-alias-interactive-bg-hover,#f6f7f8);padding:12px}
      .dsh-remote-row{display:flex;gap:10px;align-items:center;justify-content:space-between}.dsh-remote-row>div{min-width:0}
      .dsh-remote-status small{display:block;margin-top:4px}.dsh-remote-badge{display:inline-flex;align-items:center;gap:5px;font-size:12px;white-space:nowrap}
      .dsh-remote-dot{width:6px;height:6px;border-radius:50%;background:#999}.dsh-remote-dot.ready{background:#e9a23b}.dsh-remote-dot.online{background:#3a9e71}
      .dsh-remote-button{cursor:pointer;border:1px solid var(--dsw-alias-border-l2,#d8dbe2);border-radius:7px;padding:6px 10px;background:transparent;color:inherit;white-space:nowrap}
      .dsh-remote-button:hover{background:var(--dsw-alias-interactive-bg-hover,#eff0f3)}.dsh-remote-button:disabled{opacity:.45;cursor:default}
      .dsh-remote-button.primary{background:var(--dsw-alias-brand-primary-new-colorprimary-new-color,#4b65f5);color:white;border-color:transparent;padding:9px 15px}
      .dsh-remote-button.danger{color:var(--dsw-alias-state-error-primary,#ce4949)}.dsh-remote button:focus-visible,.dsh-remote input:focus-visible{outline:2px solid #7789ff;outline-offset:3px}
      .dsh-remote-linkrow{border-top:1px solid var(--dsw-alias-border-l2,#e0e2e6);margin-top:12px;padding-top:12px}
      .dsh-remote-link{display:block;width:100%;border:0;padding:6px 0;background:transparent;color:inherit;font-size:12px!important;text-overflow:ellipsis;outline-offset:1px}
      .dsh-remote-qr{margin-top:12px;min-height:300px;border:1px dashed var(--dsw-alias-border-l2,#dddfe5);border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:20px;text-align:center;background:var(--dsw-alias-interactive-bg-hover,#fafbfc)}
      .dsh-remote-qr img{width:min(240px,100%);height:auto;border-radius:8px;background:white;display:block}.dsh-remote-code{letter-spacing:4px;font-size:19px;font-weight:500;font-variant-numeric:tabular-nums}
      .dsh-remote-qr:has(>.dsh-remote-empty){min-height:200px}.dsh-remote-qr>.dsh-remote-empty{padding:0;gap:6px}
      .dsh-remote-caption{font-size:12px;color:var(--dsw-alias-label-secondary,#777b85)}.dsh-remote-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
      .dsh-remote-devices{margin-top:16px;display:grid;gap:10px}.dsh-remote-device{border-radius:10px;padding:12px;background:var(--dsw-alias-interactive-bg-hover,#f6f7f8)}
      .dsh-remote-device-name{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:190px}.dsh-remote-device small{display:block;color:var(--dsw-alias-label-secondary,#777b85);font-size:12px;margin-top:2px}
      .dsh-remote-empty{padding:30px 12px;text-align:center;display:grid;gap:8px;justify-items:center;color:var(--dsw-alias-label-secondary,#777b85)}
      .dsh-remote-help{margin-top:18px;padding-top:16px;border-top:1px solid var(--dsw-alias-border-l2,#e0e2e6);font-size:12px;color:var(--dsw-alias-label-secondary,#777b85)}
      .dsh-remote-help p+p{margin-top:8px}.dsh-remote-server{margin-top:18px;padding:12px;border-radius:9px;background:var(--dsw-alias-interactive-bg-hover,#f6f7f8);font-size:12px;overflow-wrap:anywhere}
      .dsh-remote-error{padding:10px 12px;border-radius:8px;margin-bottom:16px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#ce4949) 8%,transparent);color:var(--dsw-alias-state-error-primary,#ce4949)}
      .dsh-remote-success{color:var(--dsw-alias-state-success-primary,#3a9e71)}
      .dsh-remote-config{margin:0 0 20px;border:1px solid var(--dsw-alias-border-l2,#e0e2e6);border-radius:12px;padding:18px}.dsh-remote-config h3{font-size:15px;margin:0 0 8px}.dsh-remote-fields{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:16px 0}.dsh-remote-fields label{display:block;font-size:12px;color:var(--dsw-alias-label-secondary,#777b85)}.dsh-remote-fields .wide{grid-column:1/-1}.dsh-remote-fields input{display:block;box-sizing:border-box;width:100%;margin-top:5px;border:1px solid var(--dsw-alias-border-l2,#d8dbe2);border-radius:7px;background:transparent;color:inherit;padding:8px 10px;font-size:14px}.dsh-remote-fields input:focus{outline:2px solid #8c9aff;outline-offset:1px}
      @container(max-width:560px){.dsh-remote-grid{grid-template-columns:1fr}.dsh-remote-device-name{max-width:280px}}
      @media(max-width:650px){.dsh-remote{padding:18px}.dsh-remote-grid{grid-template-columns:1fr}}
    `;

    function Icon({ kind = 'phone', size = 20 }) {
      const paths = {
        phone: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm3 17h2',
        devices: 'M3 4h15a2 2 0 0 1 2 2v6M3 4v11h9M3 15h9m-5 0v4m-3 0h8m4-9h5v11h-5Z',
        check: 'm5 12 4 4L19 6',
        link: 'm10 13 4-4m-5 7-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 0 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0',
      };
      return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: paths[kind] || paths.phone }));
    }

    function createController(connection) {
      let value = { phase: 'loading', devices: [], link: null, busy: false, error: null };
      const listeners = new Set();
      const abort = new AbortController();
      let opened = false, disposed = false, requestNumber = 0;
      const publish = next => { value = next; for (const notify of listeners) notify(); };
      const call = async input => {
        const result = await connection.rpc.call('/api', endpoint, { ...input, clientProtocol: location.protocol, surface: opened ? 'settings' : 'client' }, abort.signal);
        if (!result.ok) throw new Error(result.error?.message || '远程控制操作失败。');
        return result.value;
      };
      const refresh = async () => {
        if (disposed || value.busy) return;
        const current = ++requestNumber;
        try { const next = await call({ action: 'status' }); if (!disposed && current === requestNumber) publish({ ...next, busy: false }); }
        catch { if (!disposed && current === requestNumber) publish({ ...value, phase: 'error', error: '暂时无法读取远程控制状态，请稍后重试。' }); }
      };
      const act = async input => {
        if (value.busy || disposed) return false;
        ++requestNumber;
        publish({ ...value, busy: input.action, error: null });
        try { const next = await call(input); if (!disposed) publish({ ...next, busy: false }); return true; }
        catch (error) { if (!disposed) publish({ ...value, busy: false, error: error.message }); return false; }
      };
      const interval = setInterval(() => { if (listeners.size && !document.hidden) void refresh(); }, 3000);
      void refresh();
      return { subscribe: notify => { listeners.add(notify); return () => listeners.delete(notify); }, getSnapshot: () => value, act,
        opened: () => { opened = true; void refresh(); return () => { opened = false; }; },
        dispose: () => { disposed = true; clearInterval(interval); abort.abort(); listeners.clear(); } };
    }

    function deviceName(label) {
      if (/iphone/i.test(label)) return 'iPhone';
      if (/ipad/i.test(label)) return 'iPad';
      if (/android/i.test(label)) return 'Android 手机';
      if (/edg\//i.test(label)) return '电脑 · Edge';
      if (/chrome\//i.test(label)) return '电脑 · Chrome';
      if (/safari\//i.test(label)) return 'Safari 浏览器';
      if (/Windows NT/i.test(label)) return 'Windows 电脑';
      if (/Macintosh/i.test(label)) return 'Mac 电脑';
      if (/X11|Linux/i.test(label)) return '电脑浏览器';
      return label || '浏览器设备';
    }

    function ConfigurationEditor({view,controller,onClose}) {
      const [fields,setFields]=React.useState(()=>({publicOrigin:view.configuration?.publicOrigin||'',destination:view.configuration?.ssh?.destination||'',identityFile:view.configuration?.ssh?.identityFile||'',port:String(view.configuration?.ssh?.port||22),remotePort:String(view.configuration?.ssh?.remotePort||18181)}));
      const input=(key,label,placeholder,wide=false)=>h('label',{className:wide?'wide':undefined},label,h('input',{value:fields[key],placeholder,autoComplete:'off',spellCheck:false,inputMode:key==='port'||key==='remotePort'?'numeric':undefined,onChange:event=>setFields({...fields,[key]:event.target.value}),disabled:!!view.busy,required:true}));
      return h('form',{className:'dsh-remote-config',onSubmit:async event=>{event.preventDefault();const saved=await controller.act({action:'configure',configuration:{publicOrigin:fields.publicOrigin.trim(),ssh:{destination:fields.destination.trim(),identityFile:fields.identityFile.trim(),port:Number(fields.port),remotePort:Number(fields.remotePort)}}});if(saved)onClose();}},
        h('h3',null,view.configured?'服务器配置':'首次使用：配置你自己的中转服务器'),
        h('p',{className:'dsh-remote-caption'},'配置只保存在这台电脑的私有目录中。安装包不包含服务器信息，也不会上传 SSH 私钥内容。'),
        h('div',{className:'dsh-remote-fields'},input('publicOrigin','HTTPS 访问入口','https://你的服务器IP:8443',true),input('destination','SSH 连接地址','用户名@服务器IP',true),input('identityFile','本机 SSH 私钥路径','C:\\path\\to\\ssh-key',true),input('port','SSH 端口','22'),input('remotePort','服务器独立转发端口','18181')),
        h('p',{className:'dsh-remote-caption'},'服务器需要准备 HTTPS 入口，并代理到独立转发端口。请先在本机核验 SSH 主机指纹。'),
        h('div',{className:'dsh-remote-actions',style:{marginTop:14}},h('button',{type:'submit',className:'dsh-remote-button primary',disabled:!!view.busy},view.busy==='configure'?'正在保存…':'保存配置'),view.configured?h('button',{type:'button',className:'dsh-remote-button',onClick:onClose,disabled:!!view.busy},'取消'):null));
    }

    function RemoteControlPage({ controller }) {
      const view = React.useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
      const [copied, setCopied] = React.useState(false);
      const [confirmDevice, setConfirmDevice] = React.useState(null);
      const [confirmReset, setConfirmReset] = React.useState(false);
      const [revealLink, setRevealLink] = React.useState(true);
      const [editingConfiguration,setEditingConfiguration]=React.useState(false);
      React.useEffect(() => controller.opened(), [controller]);
      React.useEffect(() => { if (!copied) return; const timer = setTimeout(() => setCopied(false), 2000); return () => clearTimeout(timer); }, [copied]);
      const ready = view.phase === 'ready';
      const compatible = view.protocolVersion === 2 && view.configurationSupported === true;
      const transition = ['starting', 'connecting', 'stopping'].includes(view.phase) || view.busy === 'start' || view.busy === 'stop';
      const running = !['stopped', 'loading'].includes(view.phase) && view.enabled && view.configured;
      const hasLink = compatible && !!view.link;
      const title = view.phase === 'loading' ? '读取状态中…' : transition ? (view.busy === 'stop' || view.phase === 'stopping' ? '正在关闭…' : '正在连接…') : ready ? view.connectedDevices > 0 ? `已连接 ${view.connectedDevices} 台设备` : '等待手机连接' : view.phase === 'reconnecting' ? '连接中断，正在重连' : view.phase === 'update-required' ? '远程通道需要更新' : view.phase === 'error' ? '连接需要检查' : '远程控制已关闭';
      async function copyLink() {
        if (!hasLink) return;
        try { await navigator.clipboard.writeText(view.link.url); setCopied(true); }
        catch {
          const text = document.createElement('textarea'); text.value = view.link.url; text.style.position = 'fixed'; text.style.opacity = '0'; document.body.append(text); text.select();
          const accepted = document.execCommand('copy'); text.remove(); setCopied(accepted);
        }
      }
      const button = (label, onClick, options = {}) => h('button', { type: 'button', className: 'dsh-remote-button' + (options.primary ? ' primary' : '') + (options.danger ? ' danger' : ''), onClick, disabled: !compatible || !!view.busy || options.disabled }, label);
      const badge = h('span', { className: 'dsh-remote-badge' }, h('i', { className: 'dsh-remote-dot ' + (ready ? view.connectedDevices ? 'online' : 'ready' : '') }), ready ? '已就绪' : view.phase === 'reconnecting' ? '重连中' : transition ? '连接中' : '未开启');
      return h('section', { className: 'dsh-remote', 'aria-label': '移动端远程控制' },
        h('header', { className: 'dsh-remote-head' }, h('div', { className: 'dsh-remote-icon' }, h(Icon, { kind: 'devices' })),
          h('div', null, h('h2', null, '移动端远程控制'), h('p', { className: 'dsh-remote-muted' }, '扫码或在另一台设备上打开链接，继续使用当前工作区。'))),
        view.error ? h('div', { className: 'dsh-remote-error', role: 'alert' }, view.error) : null,
        view.phase !== 'loading' && !compatible ? h('div', { className: 'dsh-remote-error', role: 'alert' }, '插件后端尚未加载更新，请重启一次 DSH。已有链接会在更新完成后显示。') : null,
        compatible && view.gatewayUpdateRequired ? h('div', { className: 'dsh-remote-error', role: 'alert' }, '当前远程通道仍是旧版。请手动点击“停止”，然后重新开启以加载更新；这会短暂断开远程设备，授权记录会保留。') : null,
        compatible&&(view.configured===false||editingConfiguration)?h(ConfigurationEditor,{view,controller,onClose:()=>setEditingConfiguration(false)}):null,
        h('div', { className: 'dsh-remote-grid' },
          h('div', { className: 'dsh-remote-card' }, h('h3', null, h(Icon, { size: 18 }), '手机扫码连接'),
            h('p', { className: 'dsh-remote-muted' }, '使用手机相机扫码，或复制链接到另一台电脑。'),
            h('div', { className: 'dsh-remote-status' },
              h('div', { className: 'dsh-remote-row' }, h('div', null, h('div', { className: 'dsh-remote-actions' }, h('span', null, title), badge),
                h('small', { className: 'dsh-remote-muted' }, ready ? '本机 DSH 正通过阿里云提供远程访问。' : hasLink ? '链接已保存，重新开启后可继续访问。' : '开启后即可生成专属访问链接。')),
                running ? button('停止', () => void controller.act({ action: 'stop' }), { disabled: transition }) : button('开启远程控制', () => void controller.act({ action: 'start' }), { primary: true, disabled: transition || view.phase === 'loading' || !view.configured })),
              ready || hasLink ? h('div', { className: 'dsh-remote-linkrow' }, h('div', { className: 'dsh-remote-row' }, h('span', { className: 'dsh-remote-caption' }, hasLink ? '长期有效，手动重置前保持不变。' : '首次生成后可长期使用。'),
                hasLink ? button(copied ? '已复制' : '复制链接', () => void copyLink()) : button('生成访问链接', () => void controller.act({ action: 'pair' }))),
                hasLink ? h('input', { className: 'dsh-remote-link', 'aria-label': '访问链接', readOnly: true, value: revealLink ? view.link.url : `${view.publicOrigin}/pair#••••••••••••••••••••`, onFocus: event => event.target.select() }) : null) : null),
            h('div', { className: 'dsh-remote-qr' },
              hasLink ? h(React.Fragment, null,
                revealLink ? h('img', { src: view.link.qrDataUrl, alt: '远程控制访问二维码', width: 240, height: 240 }) : h('div', {className:'dsh-remote-empty'}, h(Icon, {kind:'link',size:40}), h('p',null,'链接与二维码已隐藏'), h('p',{className:'dsh-remote-caption'},'屏幕共享或截图时可以保持隐藏。')),
                h('div', { className: 'dsh-remote-caption' }, ready ? '手机扫码即可打开 · 链接长期有效' : '链接已保存，开启远程控制后即可访问'),
                h('div',{className:'dsh-remote-actions'},button(revealLink?'隐藏链接与二维码':'显示二维码',()=>setRevealLink(!revealLink)), button('重置访问链接', () => setConfirmReset(true), { disabled: !ready }))) :
                h(React.Fragment, null, h('div', { className: 'dsh-remote-muted' }, h(Icon, { kind: 'phone', size: 44 })),
                  h('div', null, ready ? '生成链接后即可扫码连接' : '开启远程控制，连接这台电脑'),
                  h('p', { className: 'dsh-remote-caption' }, ready ? '关闭、重开或重启 DSH 都不会更换已生成的链接。' : '当前工作区与会话会在远程设备同步显示。'),
                  ready ? button('生成访问链接', () => void controller.act({ action: 'pair' }), { primary: true }) : null)),
            confirmReset ? h('div', { className: 'dsh-remote-help', role: 'alert' }, h('p', null, '重置后旧链接立即失效，已授权设备会断开，需要使用新链接重新连接。'),
              h('div', { className: 'dsh-remote-actions' }, button('确认重置', () => { setConfirmReset(false); void controller.act({ action: 'reset-link', confirmReset: true }); }, { danger: true }), button('取消', () => setConfirmReset(false)))) : null),
          h('aside', { className: 'dsh-remote-card' },
            h('h3', null, h(Icon, { kind: 'devices', size: 18 }), '已授权设备', h('span', { className: 'dsh-remote-muted' }, `(${view.devices.length})`)),
            h('p', { className: 'dsh-remote-muted' }, '查看连接状态，随时撤销设备访问。'),
            view.devices.length ? h('div', { className: 'dsh-remote-devices' }, view.devices.map(device =>
              h('div', { className: 'dsh-remote-device', key: device.id }, h('div', { className: 'dsh-remote-row' },
                h('div', null, h('div', { className: 'dsh-remote-device-name', title: device.label }, deviceName(device.label)),
                  h('small', null, device.connected ? '在线' : '当前离线'), h('small', null, '授权至 ' + new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(device.expiresAt))),
                button('移除', () => setConfirmDevice(device.id), { danger: true, disabled: !ready })),
                confirmDevice === device.id ? h('div', { className: 'dsh-remote-help' }, h('p', null, '移除后将立即断开此设备，需要重新配对才能访问。'),
                  h('div', { className: 'dsh-remote-actions' }, button('确认移除', () => { setConfirmDevice(null); void controller.act({ action: 'revoke', id: device.id }); }, { danger: true }), button('取消', () => setConfirmDevice(null)))) : null))) :
              h('div', { className: 'dsh-remote-empty' }, h(Icon, { kind: 'devices', size: 32 }), h('p', null, '还没有授权设备'), h('p', { className: 'dsh-remote-caption' }, '手机完成配对后会显示在这里。')),
            h('div', { className: 'dsh-remote-server' }, h('div', { className: 'dsh-remote-row' }, h('span', null, '阿里云中转'), h('span', null, ready ? '已连接' : '未连接')), h('p', { className: 'dsh-remote-muted' }, view.publicOrigin || '读取中…')),
            h('div', { className: 'dsh-remote-help' }, h('p', null, '使用期间请保持这台电脑在线，并打开 DSH。'), h('p', null, '配对设备可以操作当前工作区。请只将链接分享给你自己的设备。'),view.configured?button('修改服务器配置',()=>setEditingConfiguration(true),{disabled:running||transition}):null))));
    }

    // Scoped to this relay's browser surface. The desktop keeps its native layout.
    const remoteCss = `
      .dsh-rm{font:inherit;font-size:14px;line-height:1.5;color:var(--dsw-alias-label-primary,#272b35);pointer-events:auto}.dsh-rm *{box-sizing:border-box}.dsh-rm button{font:inherit;color:inherit;cursor:pointer}.dsh-rm button:focus-visible{outline:2px solid #7e8fff;outline-offset:2px}
      .dsh-rm-header{display:none}.dsh-rm-icon{display:grid;place-items:center;min-width:44px;min-height:44px;border:0;background:transparent;border-radius:10px;font-size:19px}.dsh-rm-icon:hover{background:var(--dsw-alias-interactive-bg-hover,#f0f2f6)}
      .dsh-rm-title{flex:1;min-width:0;line-height:1.35}.dsh-rm-title strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:550}.dsh-rm-sub{display:flex;align-items:center;gap:5px;color:var(--dsw-alias-label-secondary,#858b97);font-size:11px}.dsh-rm-dot{width:6px;height:6px;border-radius:50%;background:#e0a33a}.dsh-rm-dot.online{background:#3ca77a}
      .dsh-rm-backdrop{position:fixed;inset:calc(54px + env(safe-area-inset-top)) 0 0;background:#10131b55;border:0;z-index:70}.dsh-rm-popover{position:fixed;top:calc(62px + env(safe-area-inset-top));right:12px;width:min(320px,calc(100vw - 24px));padding:18px;border:1px solid var(--dsw-alias-border-l2,#e0e3ea);border-radius:14px;background:var(--dsw-alias-bg-layer-2,#fff);box-shadow:0 12px 45px #10152a20;z-index:95}.dsh-rm-popover h3{font-size:15px;margin:0 0 8px}.dsh-rm-popover p{margin:8px 0;font-size:13px;color:var(--dsw-alias-label-secondary,#737b8b)}.dsh-rm-action{display:block;width:100%;padding:11px 12px;min-height:44px;margin-top:10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#e0e3ea);background:transparent;text-align:center}.dsh-rm-action.danger{color:#ce5151}
      .dsh-rm-banner{position:fixed;top:12px;left:50%;transform:translateX(-50%);width:min(540px,calc(100vw - 24px));background:var(--dsw-alias-bg-layer-2,#fff);border:1px solid var(--dsw-alias-border-l2,#e1e3ea);border-radius:12px;padding:12px 16px;box-shadow:0 8px 32px #19203514;z-index:96;display:flex;align-items:center;gap:12px}.dsh-rm-banner p{margin:2px 0 0;font-size:12px;color:var(--dsw-alias-label-secondary,#777f8d)}.dsh-rm-banner button{border:1px solid var(--dsw-alias-border-l2,#ddd);background:transparent;border-radius:8px;min-height:40px;white-space:nowrap;padding:8px 12px}.dsh-rm-gate{position:fixed;inset:0;background:#171b2855;display:grid;place-items:center;z-index:200;padding:24px;backdrop-filter:blur(4px)}.dsh-rm-gate>div{max-width:380px;width:100%;padding:26px;background:var(--dsw-alias-bg-layer-2,#fff);border-radius:18px}.dsh-rm-gate h2{font-size:20px;margin:0 0 12px}.dsh-rm-gate p{font-size:14px;color:var(--dsw-alias-label-secondary,#747c8b)}
      @media(max-width:760px){
        body[data-dsh-remote-client]{height:var(--dsh-remote-vh,100dvh)!important;max-height:var(--dsh-remote-vh,100dvh);overflow:hidden;overscroll-behavior:none}
        body[data-dsh-remote-client] .BynINW_frame{box-sizing:border-box;height:var(--dsh-remote-vh,100dvh)!important;grid-template-columns:minmax(0,1fr)!important;padding-top:calc(54px + env(safe-area-inset-top));min-width:0;overflow:hidden}
        body[data-dsh-remote-client] .BynINW_centerCol{grid-column:1!important;grid-row:1;min-width:0;width:100%}
        body[data-dsh-remote-client] .BynINW_sidebarCol{display:none!important}
        body[data-dsh-remote-client][data-dsh-remote-drawer] .BynINW_sidebarCol{display:flex!important;position:fixed;left:0;top:calc(54px + env(safe-area-inset-top));bottom:0;width:min(88vw,280px)!important;height:calc(var(--dsh-remote-vh,100dvh) - 54px - env(safe-area-inset-top));z-index:80;border-right:1px solid var(--dsw-alias-border-l2,#dfe2e8);background:var(--dsw-alias-bg-layer-2,#fff);box-shadow:12px 0 40px #17203918}
        body[data-dsh-remote-client][data-dsh-remote-drawer] .BynINW_sidebarCol button{min-height:40px}
        body[data-dsh-remote-client] .BynINW_rightbarCol{position:fixed;inset:calc(54px + env(safe-area-inset-top)) 0 0;z-index:60;width:100%!important;background:var(--dsw-alias-bg-layer-2,#fff)}
        body[data-dsh-remote-client] .BynINW_frame[data-rightbar-collapsed=true] .BynINW_rightbarCol{display:none!important}
        body[data-dsh-remote-client] .BynINW_leadingSeat{display:none!important}
        .dsh-rm-header{position:fixed;top:0;left:0;right:0;height:calc(54px + env(safe-area-inset-top));padding:env(safe-area-inset-top) 7px 0;display:flex;align-items:center;gap:5px;background:var(--dsw-alias-bg-layer-2,#fff);border-bottom:1px solid var(--dsw-alias-border-l2,#e7e9ef);z-index:90}
        .dsh-rm-banner{top:calc(62px + env(safe-area-inset-top))}
        body[data-dsh-remote-client] .Dc7zOa_root{min-width:0!important;width:100%;max-width:100%}
        body[data-dsh-remote-client] .Dc7zOa_header{padding:8px 12px;gap:8px;min-width:0}
        body[data-dsh-remote-client] .Dc7zOa_headerLeading{display:none}
        body[data-dsh-remote-client] .Dc7zOa_headerActions{gap:5px;min-width:0}
        body[data-dsh-remote-client] .Dc7zOa_composerSeat{padding-left:10px;padding-right:10px;padding-bottom:max(10px,env(safe-area-inset-bottom))}
        body[data-dsh-remote-client] .Dc7zOa_composerHero{padding:16px!important;width:100%;max-width:100%}
        body[data-dsh-remote-client] .RlGAzG_card{border-radius:16px;min-width:0;max-width:100%}
        body[data-dsh-remote-client] .RlGAzG_input,body[data-dsh-remote-client] .RlGAzG_input [contenteditable]{font-size:16px!important;max-height:min(30dvh,200px);overflow-y:auto}
        body[data-dsh-remote-client] .RlGAzG_row{gap:6px;min-width:0}
        body[data-dsh-remote-client] .RlGAzG_tools{overflow-x:auto;min-width:0;scrollbar-width:none}
        body[data-dsh-remote-client] .RlGAzG_primary{min-width:44px;min-height:44px;flex-shrink:0}
        body[data-dsh-remote-client] .RlGAzG_add,body[data-dsh-remote-client] .RlGAzG_select{min-height:40px}
        body[data-dsh-remote-client] pre{max-width:100%;overflow-x:auto;overscroll-behavior-x:contain}
        body[data-dsh-remote-client] .Dc7zOa_body,body[data-dsh-remote-client] .Dc7zOa_viewArea,body[data-dsh-remote-client] .Dc7zOa_scrollBody{min-width:0;max-width:100%}
        body[data-dsh-remote-client] [role=dialog]{max-width:calc(100vw - 24px);max-height:calc(var(--dsh-remote-vh,100dvh) - 24px);overflow:auto}
      }
    `;

    function RemoteShell({ connection, sessions, layout }) {
      const connectionState = React.useSyncExternalStore(connection.state.subscribe, connection.state.getSnapshot, connection.state.getSnapshot);
      const list = React.useSyncExternalStore(sessions.list.subscribe, sessions.list.getSnapshot, sessions.list.getSnapshot);
      const current = Object.values(list.byId || {}).find(item => (item.retainedBy?.mainView || 0) > 0);
      const [drawer, setDrawer] = React.useState(false), [menu, setMenu] = React.useState(false), [confirmLogout, setConfirmLogout] = React.useState(false);
      const [access, setAccess] = React.useState('checking'), [reconnecting, setReconnecting] = React.useState(false);
      const reconnectTimer = React.useRef(null);
      const connected = connectionState === 'connected';
      const [error, setError] = React.useState(null);
      React.useEffect(()=>()=>clearTimeout(reconnectTimer.current),[]);
      React.useEffect(()=>{
        const media=window.matchMedia('(max-width:760px)');
        const resize=()=>{if(!media.matches){setDrawer(false);setMenu(false);}};
        media.addEventListener('change',resize);resize();return()=>media.removeEventListener('change',resize);
      },[]);
      React.useEffect(() => { if (drawer) document.body.dataset.dshRemoteDrawer = ''; else delete document.body.dataset.dshRemoteDrawer; return () => { delete document.body.dataset.dshRemoteDrawer; }; }, [drawer]);
      React.useEffect(() => { setDrawer(false); }, [current?.id]);
      React.useEffect(() => {
        if(!drawer) return;
        const frame=document.querySelector('.BynINW_frame'); if(!frame) return;
        const observer=new MutationObserver(()=>{if(frame.dataset.sidebarCollapsed==='true')setDrawer(false);});
        observer.observe(frame,{attributes:true,attributeFilter:['data-sidebar-collapsed']});return()=>observer.disconnect();
      },[drawer]);
      React.useEffect(() => {
        if (!drawer && !menu) return;
        const escape = event => { if(event.key === 'Escape') {setDrawer(false);setMenu(false);} };
        document.addEventListener('keydown', escape); return () => document.removeEventListener('keydown', escape);
      }, [drawer, menu]);
      React.useEffect(() => {
        const abort = new AbortController(); let checking = false;
        const check = async () => {
          if (checking || document.hidden) return; checking = true;
          try { const response = await fetch('/remote/access', { signal:AbortSignal.any([abort.signal, AbortSignal.timeout(8000)]), cache:'no-store', redirect:'error' }); if (!abort.signal.aborted) setAccess(response.status === 401 ? 'revoked' : response.ok ? 'authorized' : 'offline'); }
          catch { if(!abort.signal.aborted) setAccess('offline'); } finally { checking = false; }
        };
        void check(); const timer = setInterval(check, 10000);
        const resume = () => { void check(); if (!document.hidden && !connected) connection.reconnect(); };
        document.addEventListener('visibilitychange', resume); window.addEventListener('online', resume);
        return () => { abort.abort(); clearInterval(timer); document.removeEventListener('visibilitychange',resume); window.removeEventListener('online',resume); };
      }, [connection, connected]);
      async function reconnect() { setReconnecting(true); connection.reconnect(); clearTimeout(reconnectTimer.current); reconnectTimer.current=setTimeout(() => setReconnecting(false), 1800); }
      async function logout() {
        try { const response=await fetch('/remote/logout',{method:'POST',headers:{'content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(8000)}); if(response.ok || response.status===401) location.replace('/pair'); else setError('暂时无法断开，请稍后重试。'); }
        catch {setError('网络暂时不可用，请恢复连接后重试。');}
      }
      const title = current?.blank ? '新会话' : current?.displayTitle || current?.title || 'DeepSeek Harness';
      const status = connected ? '已连接到你的电脑' : '正在恢复连接';
      function toggleDrawer() {
        setMenu(false);
        if(!drawer && document.querySelector('.BynINW_frame')?.dataset.sidebarCollapsed==='true') layout.toggleSidebar();
        setDrawer(!drawer);
      }
      return h('div', {className:'dsh-rm'},
        h('header',{className:'dsh-rm-header'},
          h('button',{type:'button',className:'dsh-rm-icon','aria-label':drawer?'关闭会话列表':'打开会话列表','aria-expanded':drawer,onClick:toggleDrawer}, drawer ? '×' : '☰'),
          h('div',{className:'dsh-rm-title'},h('strong',null,title),h('span',{className:'dsh-rm-sub'},h('i',{className:'dsh-rm-dot '+(connected?'online':'')}),status)),
          h('button',{type:'button',className:'dsh-rm-icon','aria-label':'返回对话',onClick:()=>{layout.selectPanel(null);layout.closeRightbar();setDrawer(false);setMenu(false);}},'↩'),
          h('button',{type:'button',className:'dsh-rm-icon','aria-label':'远程连接选项','aria-expanded':menu,onClick:()=>{setDrawer(false);setMenu(!menu);setConfirmLogout(false);}},'⋯')),
        drawer ? h('button',{className:'dsh-rm-backdrop','aria-label':'关闭会话列表',onClick:()=>setDrawer(false)}) : null,
        menu ? h('section',{className:'dsh-rm-popover','aria-label':'远程连接选项'},h('h3',null,'远程连接'),h('p',null,status),h('p',null,'访问链接长期有效。电脑重启后，等待 DSH 和远程服务恢复即可继续。'),
          h('button',{className:'dsh-rm-action',onClick:()=>void reconnect(),disabled:reconnecting},reconnecting?'正在重连…':'重新连接'),
          confirmLogout ? h(React.Fragment,null,h('p',null,'仅断开这台浏览器。再次访问时，需要使用桌面端的访问链接。'),h('button',{className:'dsh-rm-action danger',onClick:()=>void logout()},'确认断开此设备')) : h('button',{className:'dsh-rm-action',onClick:()=>setConfirmLogout(true)},'断开此设备'),error ? h('p',{role:'alert'},error):null) : null,
        !connected && access !== 'revoked' ? h('div',{className:'dsh-rm-banner',role:'status'},h('div',{style:{flex:1}},h('strong',null,'连接暂时中断'),h('p',null,'请保持电脑在线，恢复连接后会自动同步任务状态。')),h('button',{onClick:()=>void reconnect(),disabled:reconnecting},reconnecting?'重连中…':'重新连接')):null,
        access==='revoked' ? h('div',{className:'dsh-rm-gate',role:'alertdialog','aria-modal':true,'aria-label':'需要重新连接'},h('div',null,h('h2',null,'此设备需要重新连接'),h('p',null,'设备授权已失效或被移除。请使用桌面端当前的访问链接重新连接。'),h('button',{className:'dsh-rm-action',onClick:()=>location.replace('/pair')},'前往连接页面'))):null);
    }

    function applyRemoteUi(ctx) {
      ctx.effect(() => {
        const style=document.createElement('style'); style.dataset.dshRemoteMobile=''; style.textContent=remoteCss; document.head.append(style); document.body.dataset.dshRemoteClient='';
        const viewport=window.visualViewport;
        const resize=()=>document.body.style.setProperty('--dsh-remote-vh',`${Math.round(viewport?.height || window.innerHeight)}px`);
        resize(); viewport?.addEventListener('resize',resize); window.addEventListener('resize',resize);
        return()=>{style.remove();delete document.body.dataset.dshRemoteClient;delete document.body.dataset.dshRemoteDrawer;document.body.style.removeProperty('--dsh-remote-vh');viewport?.removeEventListener('resize',resize);window.removeEventListener('resize',resize);};
      },`${NS}: remote layout`);
      ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'dsh-remote-mobile',order:900,inject:()=>({connection:ctx.connection,sessions:ctx.sessions,layout:ctx.layout})},RemoteShell));
    }

    function apply(ctx) {
      if (location.protocol !== 'dsh-app:' && !['127.0.0.1', 'localhost'].includes(location.hostname)) { applyRemoteUi(ctx); return; }
      const controller = createController(ctx.connection);
      ctx.effect(() => () => controller.dispose(), `${NS}: controller`);
      ctx.effect(() => { const style = document.createElement('style'); style.dataset.dshRemoteAliyun = ''; style.textContent = css; document.head.append(style); return () => style.remove(); }, `${NS}: settings styles`);
      ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'remote-control-aliyun', order: 70, label: () => '远程控制', inject: () => ({ controller }) }, RemoteControlPage));
    }
    return { name: NS, inject: ['slots', 'connection', 'sessions', 'layout'], apply };
  },
});
