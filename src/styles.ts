// All plugin CSS, scoped with the dbx- prefix. Rendered once per screen with <Styles />.
export const CSS = `
.dbx-root{--x-bg:#0b0e13;--x-panel:#1a1e26;--x-panel2:#222833;--x-line:#2d3441;--x-text:#e6e9ee;--x-dim:#8b95a5;
  --x-blue:#1a9fff;--x-fbg:#e3e8ee;--x-ffg:#0b0e13;--x-good:#5bd17a;--x-bad:#ff6b6b;--x-warn:#f2b84b;}
.dbx-root *{box-sizing:border-box}
.dbx-root div:focus,.dbx-root div:focus-visible{outline:none}

/* glyphs and inline formatting */
.dbx-glyph{display:inline-flex;align-items:center;justify-content:center;min-width:1.4em;height:1.4em;padding:0 .3em;border-radius:.7em;
  background:#3a4250;color:#fff;font-size:.72em;font-weight:700;line-height:1;vertical-align:.08em;margin:0 .1em}
.dbx-glyph.wide{border-radius:.3em;min-width:1.8em}
.dbx-glyph-a{background:#2f8f4e}.dbx-glyph-b{background:#b73b3b}.dbx-glyph-x{background:#2d63b8}.dbx-glyph-y{background:#b39320}
.dbx-mark{background:rgba(26,159,255,.18);color:#9fd2ff;padding:0 4px;border-radius:3px}
.dbx-root strong{color:#fff;font-weight:600}

/* game cover placeholder */
.dbx-cover{border-radius:5px;flex:none;display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;
  background:linear-gradient(135deg,hsl(var(--h) 45% 38%),hsl(calc(var(--h) + 40) 50% 22%))}

/* ===== Quick Access panel ===== */
.dbx-now{margin:0 0 8px;padding:10px;border-radius:10px;background:linear-gradient(135deg,#123251,#1a2433 70%);border:1px solid #2b5c8a;
  display:flex;flex-direction:column;gap:6px}
.dbx-now-h{display:flex;align-items:center;gap:10px;padding:0 2px 2px}
.dbx-now-h .dbx-cover{width:36px;height:36px;font-size:12px}
.dbx-now-k{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#7cc4ff;font-weight:700}
.dbx-now-n{font-weight:700;font-size:16px;line-height:1.2}
.dbx-nowg{display:flex;align-items:center;gap:10px;padding:10px;border-radius:6px;background:rgba(255,255,255,.06)}
.dbx-nowg-main{flex:1;min-width:0}
.dbx-nowg-t{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dbx-nowg-s{font-size:12px;color:#9fb6cc}
.dbx-nowg-go{font-size:12px;font-weight:700;color:#7cc4ff;white-space:nowrap}
.dbx-nowg.dbx-focus{background:var(--x-fbg);color:var(--x-ffg)}
.dbx-nowg.dbx-focus .dbx-nowg-s{color:#3d4654}.dbx-nowg.dbx-focus .dbx-nowg-go{color:#0b5ea8}
.dbx-now-empty{font-size:13px;color:#9fb6cc;padding:0 2px 2px}
.dbx-srv{padding:10px 12px;border-radius:8px;background:#11151b;border:1px solid var(--x-line);display:grid;grid-template-columns:1fr auto;gap:2px 10px;width:100%}
.dbx-srv-k{font-size:12px;color:var(--x-dim)}
.dbx-srv-url{font-family:monospace;font-size:14px;color:#9fd2ff;grid-column:1/-1;margin-bottom:6px;word-break:break-all}
.dbx-srv-code{font-family:monospace;font-size:22px;letter-spacing:.12em;font-weight:500}
.dbx-srv-timer{font-size:12px;color:var(--x-dim);align-self:end;text-align:right}
.dbx-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--x-good);margin-right:6px}
.dbx-up{display:flex;gap:10px;align-items:flex-start;padding:8px;border-radius:6px;width:100%}
.dbx-up.dbx-focus{background:var(--x-fbg);color:var(--x-ffg)}
.dbx-up-ic{width:20px;height:20px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#0b0e13;margin-top:1px}
.dbx-up-ic.ok{background:var(--x-good)}.dbx-up-ic.err{background:var(--x-bad)}
.dbx-up-main{flex:1;min-width:0}
.dbx-up-name{font-family:monospace;font-size:13px;word-break:break-all}
.dbx-up-sub{font-size:12px;color:var(--x-dim)}
.dbx-up.dbx-focus .dbx-up-sub{color:#3d4654}
.dbx-up-err{margin-top:6px;font-size:12px;font-family:monospace;background:rgba(255,107,107,.12);color:#ffb3b3;padding:6px;border-radius:4px;word-break:break-word}
.dbx-up.dbx-focus .dbx-up-err{background:#f7d4d4;color:#7a1414}
.dbx-meta{font-size:13px;color:var(--x-dim);padding:2px 0}

/* ===== full-screen pages ===== */
.dbx-page{position:absolute;inset:0;padding-top:40px;padding-bottom:40px;background:var(--x-bg);color:var(--x-text);display:flex;flex-direction:column;font-size:16px;line-height:1.45}
.dbx-topbar{flex:none;height:60px;display:flex;align-items:center;gap:14px;padding:0 28px;border-bottom:1px solid var(--x-line);background:#10141a}
.dbx-crumb{font-size:21px;font-weight:600}
.dbx-crumb span{color:var(--x-dim);margin:0 8px}
.dbx-count{margin-left:auto;color:var(--x-dim);font-size:14px}
.dbx-loading{padding:40px;color:var(--x-dim)}

/* library */
.dbx-lib{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,520px) 1fr}
.dbx-lib-left{display:flex;flex-direction:column;border-right:1px solid var(--x-line);min-height:0}
.dbx-lib-search{padding:14px 18px 8px}
.dbx-lib-list{flex:1;min-height:0;overflow-y:auto;padding:4px 18px 24px;display:flex;flex-direction:column;gap:2px}
.dbx-game{display:flex;align-items:center;gap:12px;padding:7px 10px;border-radius:6px}
.dbx-game .dbx-cover{width:42px;height:42px;font-size:14px}
.dbx-game-main{flex:1;min-width:0}
.dbx-game-name{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dbx-game-sub{font-size:13px;color:var(--x-dim)}
.dbx-game-sub.has{color:#7cc4ff}
.dbx-chev{color:var(--x-dim);font-size:14px;width:16px;text-align:center}
.dbx-game.playing{background:#13263a;box-shadow:inset 3px 0 0 var(--x-blue)}
.dbx-game.dbx-focus{background:var(--x-fbg);color:var(--x-ffg);box-shadow:none}
.dbx-game.dbx-focus .dbx-game-sub,.dbx-game.dbx-focus .dbx-chev{color:#3d4654}
.dbx-game.dbx-focus .dbx-game-sub.has{color:#0b5ea8}
.dbx-badge{font-size:11px;font-weight:700;letter-spacing:.04em;padding:2px 8px;border-radius:999px;background:var(--x-blue);color:#fff;margin-left:8px;vertical-align:2px}
.dbx-badge.muted{background:#3a4250}
.dbx-grow{margin-left:54px;padding:8px 10px;border-radius:6px;display:flex;justify-content:space-between;gap:12px;align-items:center}
.dbx-grow-t{font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dbx-grow-s{font-size:12px;color:var(--x-dim);white-space:nowrap}
.dbx-grow.dbx-focus{background:var(--x-fbg);color:var(--x-ffg)}
.dbx-grow.dbx-focus .dbx-grow-s{color:#3d4654}
.dbx-ghint{margin-left:54px;padding:4px 10px 8px;font-size:13px;color:var(--x-dim)}
.dbx-empty{padding:28px 10px;color:var(--x-dim)}
.dbx-detail{padding:32px 40px;display:flex;flex-direction:column;gap:14px;overflow:hidden}
.dbx-d-k{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--x-dim);font-weight:600}
.dbx-d-title{font-size:32px;font-weight:700;line-height:1.1}
.dbx-d-sum{color:#c3cad5;max-width:56ch}
.dbx-chips{display:flex;gap:8px;flex-wrap:wrap}
.dbx-chip{font-size:12px;padding:3px 10px;border-radius:999px;background:var(--x-panel2);color:#c3cad5}
.dbx-d-secs{display:flex;flex-direction:column;gap:5px}
.dbx-d-secs div{display:flex;gap:12px;color:#c3cad5}
.dbx-d-secs b{color:var(--x-dim);font-weight:500;width:22px;font-variant-numeric:tabular-nums}
.dbx-d-cover{width:100%;max-width:440px;aspect-ratio:460/215;border-radius:8px;display:flex;align-items:flex-end;padding:16px;font-size:28px;font-weight:700;
  background:linear-gradient(135deg,hsl(var(--h) 45% 34%),hsl(calc(var(--h) + 40) 50% 16%))}

/* viewer */
.dbx-vw-top .dbx-cover{width:40px;height:40px;font-size:13px}
.dbx-vw-game{font-size:13px;color:var(--x-dim)}
.dbx-vw-title{font-size:21px;font-weight:700;line-height:1.1}
.dbx-vw-meta{margin-left:auto;display:flex;gap:18px;color:var(--x-dim);font-size:14px;align-items:center}
.dbx-prog{display:flex;align-items:center;gap:8px}
.dbx-prog-bar{width:90px;height:6px;border-radius:3px;background:#2a303b;overflow:hidden}
.dbx-prog-bar i{display:block;height:100%;background:var(--x-good)}
.dbx-vw-body{flex:1;min-height:0;display:grid;grid-template-columns:250px 1fr}
.dbx-toc{border-right:1px solid var(--x-line);padding:16px 12px;display:flex;flex-direction:column;gap:3px;background:#0e1217;overflow-y:auto}
.dbx-toc .dbx-d-k{padding:0 10px 8px}
.dbx-toc-i{padding:9px 12px;border-radius:6px;display:flex;gap:12px;color:#aab3c0}
.dbx-toc-i b{font-weight:500;color:var(--x-dim);font-variant-numeric:tabular-nums}
.dbx-toc-i.cur{color:var(--x-text);background:#1b222c;box-shadow:inset 3px 0 0 var(--x-blue)}
.dbx-toc-i.dbx-focus{background:var(--x-fbg);color:var(--x-ffg)}
.dbx-toc-i.dbx-focus b{color:#3d4654}
.dbx-vw-content{overflow-y:auto;position:relative;padding:22px 44px 60px;scroll-padding:24px}
.dbx-sec-head{display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin-bottom:12px;max-width:900px}
.dbx-sec-title{font-size:28px;font-weight:700}
.dbx-sec-pos{color:var(--x-dim);font-size:14px;white-space:nowrap}
.dbx-blocks{display:flex;flex-direction:column;gap:8px;max-width:900px}
.dbx-blk{padding:10px 14px;border-radius:8px;border:2px solid transparent;position:relative}
.dbx-blk.dbx-focus{border-color:var(--x-blue);background:#151c26}
.dbx-h{font-size:19px;font-weight:600;margin:12px 0 0;padding:0 16px}
.dbx-text{max-width:70ch;color:#d5dae2;margin:0}
.dbx-list{margin:0;padding-left:22px;display:flex;flex-direction:column;gap:5px;color:#d5dae2}
.dbx-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}
.dbx-st{background:var(--x-panel);border-radius:6px;padding:8px 12px}
.dbx-st-l{font-size:12px;color:var(--x-dim)}
.dbx-st-v{font-size:20px;font-weight:600}
.dbx-call{display:grid;grid-template-columns:4px 1fr;gap:0 12px;background:var(--x-panel)}
.dbx-call::before{content:"";grid-row:1/3;border-radius:2px;background:var(--tone)}
.dbx-call-t{font-weight:700;color:var(--tone)}
.dbx-call-b{color:#d5dae2}
.dbx-tone-tip{--tone:var(--x-good)}.dbx-tone-warning{--tone:var(--x-warn)}.dbx-tone-note{--tone:#9fb4ff}
.dbx-ck-group{display:flex;flex-direction:column;gap:2px}
.dbx-ck{display:flex;gap:12px;align-items:flex-start;padding:8px 14px}
.dbx-box{width:22px;height:22px;border-radius:5px;border:2px solid #5a6474;flex:none;margin-top:1px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#0b0e13}
.dbx-ck.done .dbx-box{background:var(--x-good);border-color:var(--x-good)}
.dbx-ck.done .dbx-ck-t strong{color:inherit}
.dbx-ck.done .dbx-ck-t{color:var(--x-dim);text-decoration:line-through;text-decoration-color:#5a6474}
.dbx-tbl-cap{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-weight:600;gap:12px}
.dbx-tbl-hint{font-size:13px;color:var(--x-dim);font-weight:500;display:flex;gap:6px;align-items:center;visibility:hidden;white-space:nowrap}
.dbx-blk.dbx-focus .dbx-tbl-hint,.dbx-blk.live .dbx-tbl-hint{visibility:visible}
.dbx-tbl{overflow:auto;position:relative;max-height:360px;border-radius:6px;border:1px solid var(--x-line)}
.dbx-tbl table{border-collapse:separate;border-spacing:0;font-size:15px;min-width:100%}
.dbx-tbl th,.dbx-tbl td{padding:8px 14px;border-bottom:1px solid var(--x-line);white-space:nowrap;background:var(--x-bg);text-align:left}
.dbx-tbl th{position:sticky;top:0;z-index:2;background:#151a22;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--x-dim);font-weight:600}
.dbx-tbl td{font-variant-numeric:tabular-nums}
.dbx-tbl .r{text-align:right}.dbx-tbl .c{text-align:center}
.dbx-tbl.sticky th:first-child,.dbx-tbl.sticky td:first-child{position:sticky;left:0;z-index:1;box-shadow:1px 0 0 var(--x-line)}
.dbx-tbl.sticky th:first-child{z-index:3}
.dbx-tbl td:first-child{font-weight:600}
.dbx-tbl tr:last-child td{border-bottom:0}
.dbx-blk.live{border-color:var(--x-blue);background:#151c26}
.dbx-blk.live .dbx-tbl{border-color:var(--x-blue)}
.dbx-tbl tr.row-on td{background:#18283a}
.dbx-tbl th.col-on{color:#9fd2ff}
.dbx-tbl td.dbx-cell.dbx-focus{background:var(--x-fbg)!important;color:var(--x-ffg)}
.dbx-sort{color:#9fd2ff;margin-left:4px}
.dbx-sec-next{margin-top:18px;color:var(--x-dim);font-size:14px;display:flex;gap:8px;align-items:center;padding-left:16px}

/* rename modal */
.dbx-modal-note{font-size:13px;color:#8b95a5;margin-top:8px}
`;
