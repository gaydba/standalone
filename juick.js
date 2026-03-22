const API = location.hostname === 'localhost' ? '/api' : '//api.juick.com';

let tag = '';
let lastMid = 0;
let maxMid = 0;
let isLoading = false;
let currentTag = '';
let feedCache = null;
let prevdate = '';

const LIKES = {
  1: { emoji: 'em---1' },
  2: { emoji: 'em-heart_eyes' },
  3: { emoji: 'em-joy' },
  4: { emoji: 'em-thinking_face' },
  5: { emoji: 'em-rage' },
  6: { emoji: 'em-six_pointed_star' },
  7: { emoji: 'em-cry' }
};

const FIRST_POST = new Date(2009, 11, 17);
const MIN_MID = 427988;

const loadedScripts = {};

// --- API ---

async function api(path) {
  const res = await fetch(API + path);
  return res.json();
}

async function apiPost(path, data) {
  return fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: data
  });
}

// --- DOM helpers ---

function $(id) { return document.getElementById(id); }
function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

function contentWidth() {
  return Math.min(window.innerWidth, 800);
}

function escapeHtml(txt) {
  return txt.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function loadScriptOnce(src, onload) {
  if (loadedScripts[src]) {
    if (onload) onload();
    return;
  }
  loadedScripts[src] = true;
  const s = document.createElement('script');
  s.src = src;
  s.async = true;
  if (onload) s.onload = onload;
  document.body.appendChild(s);
}

// --- Hash routing ---

function getHash(key) {
  const query = location.hash.substring(1);
  if (query[0] === '!' && key === 'message') return query.substring(1);
  for (const part of query.split('&')) {
    const [k, v] = part.split('=');
    if (k === key) return v;
  }
}

// --- Init ---

function setRandomTopic() {
  $('hdr-text').textContent = titles[Math.floor(Math.random() * titles.length)];
}

async function juickInit(uname) {
  setRandomTopic();
  isLoading = false;

  const message = getHash('message');
  tag = getHash('tag');
  lastMid = parseInt(getHash('before_mid')) || 0;

  const msgs = $('messages');
  const replies = $('replies');

  if (message && message > 0) {
    if (msgs.childNodes.length > 0) {
      feedCache = {
        html: msgs.innerHTML,
        scrollY: window.scrollY,
        lastMid, tag: currentTag, prevdate
      };
    }
    clear(msgs);
    clear(replies);
    const json = await api(`/thread?mid=${message}`);
    parseThread(json);
  } else if (feedCache) {
    clear(replies);
    msgs.innerHTML = feedCache.html;
    lastMid = feedCache.lastMid;
    currentTag = feedCache.tag;
    prevdate = feedCache.prevdate;
    const scrollY = feedCache.scrollY;
    feedCache = null;
    setTimeout(() => window.scrollTo(0, scrollY), 0);
  } else {
    feedCache = null;
    clear(msgs);
    clear(replies);
    let url = `/messages?uname=${uname}&withrecommended=1`;
    if (tag) url += `&tag=${encodeURI(tag)}`;
    if (lastMid > 0) url += `&before_mid=${lastMid}`;
    const json = await api(url);
    parseMessages(json);
  }
}

// --- Render messages ---

function renderPost(post, showLikes) {
  const ts = post.timestamp.split(/[-\s]/);
  const date = new Date(ts[0], ts[1] - 1, ts[2]);
  const currdate = `${date.getDate()} ${date.getMonthName()} ${1900 + date.getYear()}`;

  let html = `<div class="post" id="${post.mid}">`;

  if (post.tags) {
    html += '<div><ul class="tags">';
    for (const t of post.tags) {
      html += `<li><a href="#tag=${t}">${t}</a></li>`;
    }
    html += '</ul></div>';
  }

  html += '<div class="text">';
  if (post.photo) {
    html += `<div class="photo"><a href="${post.attachment.url}"><img loading="lazy" src="${post.attachment.url}" alt="Photo"/></a></div>`;
  }
  if (post.video) {
    html += `<b>Attachment:</b> <a href="${post.video.mp4}">Video</a><br/>`;
  }
  if (post.location) {
    html += `<b>Location:</b> <a href="/places/${post.location.place_id}">${post.location.name}</a><br/>`;
  }
  html += formatText(post.body || '');
  html += '</div>';

  if (showLikes) {
    const serverLikes = {};
    if (post.reactions) {
      for (const r of post.reactions) serverLikes[r.id] = r;
    }

    let likes = '';
    for (let a = 1; a <= 7; a++) {
      const count = (post.reactions && a in serverLikes) ? serverLikes[a].count : ' ';
      likes += `<span class="likes-pair"><a class="like" data-id="${a}" data-mid="${post.mid}">` +
        `<i class="em ${LIKES[a].emoji}"></i></a>` +
        `<span class="counter" id="${post.mid}${a}">${count} </span></span>`;
    }

    html += `<div class="meta"><span class="likes">${likes}</span>` +
      `<span class="timestamp"><a href="#message=${post.mid}">${currdate}</a></span></div>`;
  } else {
    html += `<div class="meta"><span class="timestamp">${currdate}</span></div>`;
  }

  html += '</div>';
  return { html, currdate };
}

function appendMessages(json) {
  const msgs = $('messages');
  const showLikes = !getHash('message');

  for (let i = 0; i < json.length; i++) {
    const post = json[i];
    lastMid = post.mid;
    if (maxMid < lastMid) maxMid = parseInt(lastMid);

    const { html, currdate } = renderPost(post, showLikes);

    const li = document.createElement('li');
    li.innerHTML = html;
    msgs.appendChild(li);

    if (currdate !== prevdate && prevdate !== '' && i > 0) {
      const pts = json[i - 1].timestamp.split(/[-\s]/);
      const pdate = new Date(pts[0], pts[1] - 1, pts[2]).getTime();
      const daysback = Math.floor((Date.now() - pdate) / 86400000) + 365;
      insertTimehop(json[i - 1].mid, daysback);
    }
    prevdate = currdate;
  }

  $('topnavbutton').innerHTML = '<a href="#" onclick="randomDay();return false"><img src="rsz_shuffle.png"></a>';
  loadEmbedScripts();
}

function parseMessages(json) {
  prevdate = '';
  currentTag = tag || '';
  appendMessages(json);
}

// --- Thread ---

function parseThread(json) {
  parseMessages([json[0]]);

  const replies = $('replies');
  for (let i = 1; i < json.length; i++) {
    const r = json[i];
    let html = `<div class="username"><a href="http://juick.com/${r.user.uname}/">@${r.user.uname}</a>:</div>`;
    html += '<div class="text">';
    if (r.photo) {
      html += `<div class="photo"><a href="${r.photo.medium}"><img src="${r.photo.small}" alt="Photo"/></a></div>`;
    }
    if (r.video) {
      html += `<b>Attachment:</b> <a href="${r.video.mp4}">Video</a><br/>`;
    }
    html += formatText(r.body);
    html += '</div>';

    const li = document.createElement('li');
    li.style.backgroundImage = `url(http://i.juick.com/as/${r.user.uid}.png)`;
    li.innerHTML = html;
    replies.appendChild(li);
  }
}

// --- Timehop ---

async function insertTimehop(id, daysback) {
  const data = await api(`/messages?uname=${juickName}&daysback=${daysback}`);
  if (data.length > 0) {
    const mid = parseInt(data[0].mid) + 1;
    const li = document.createElement('li');
    li.innerHTML = `<div class="timehop"><a href="#before_mid=${mid}">Этот день год назад.</a></div>`;
    const post = document.getElementById(id);
    if (post && post.parentNode) {
      post.parentNode.parentNode.insertBefore(li, post.parentNode.nextSibling);
    }
  }
}

// --- Random ---

async function randomDay(retries = 0) {
  if (retries > 10) { location.hash = '#'; return; }
  const maxDays = Math.floor((Date.now() - FIRST_POST.getTime()) / 86400000);
  const day = Math.floor(Math.random() * maxDays) + 1;
  const json = await api(`/messages?uname=${juickName}&daysback=${day}`);
  if (json.length > 0) {
    location.hash = `#before_mid=${parseInt(json[0].mid) + 1}`;
  } else {
    randomDay(retries + 1);
  }
}

// --- Embeds ---

function hideDeadPost(el) {
  const li = el.closest('li');
  if (!li) return;
  // убираем соседний timehop если есть
  const next = li.nextElementSibling;
  if (next && next.querySelector('.timehop')) {
    next.style.display = 'none';
  } else {
    const prev = li.previousElementSibling;
    if (prev && prev.querySelector('.timehop')) prev.style.display = 'none';
  }
  li.style.display = 'none';
}

function hideDeadEmbeds() {
  document.querySelectorAll('.twitter-tweet').forEach(el => hideDeadPost(el));
  document.querySelectorAll('.imgur-embed-pub').forEach(el => {
    if (!el.nextElementSibling || el.nextElementSibling.tagName !== 'IFRAME') {
      hideDeadPost(el);
    }
  });
}

function loadEmbedScripts() {
  if (document.querySelector('.twitter-tweet')) {
    loadScriptOnce('https://platform.twitter.com/widgets.js', () => {
      if (window.twttr && twttr.widgets) twttr.widgets.load();
    });
  }
  if (document.querySelector('.imgur-embed-pub'))
    loadScriptOnce('https://s.imgur.com/min/embed.js');
  if (document.querySelector('.reddit-card'))
    loadScriptOnce('https://embed.redditmedia.com/widgets/platform.js');
  if (document.querySelector('.instagram-media'))
    loadScriptOnce('https://platform.instagram.com/en_US/embeds.js');
  setTimeout(hideDeadEmbeds, 5000);
}

// --- Text formatting ---

function formatText(txt) {
  txt = escapeHtml(txt);
  txt = txt.replace(/\n/g, '<br/>');
  return urlify(txt);
}

function classify(url) {
  if (/\.(jpg|png|gif|jpeg|svg)((\?|:).+)?$/.test(url)) return 'image';
  if (/(youtube|youtu)\.(com|be)/.test(url)) return 'youtube';
  if (/vimeo\.com/.test(url)) return 'vimeo';
  if (/reddit\.com\/r\/.*\/comments/.test(url)) return 'reddit';
  if (/reddituploads/.test(url)) return 'image';
  if (/^https?:\/\/(?:i\.)?imgur\.com/.test(url)) return 'imgur';
  if (/coub\.com\/view/.test(url)) return 'coub';
  if (/(twitter|x)\.com\/.*\/status/.test(url)) return 'twitter';
  if (/gfycat\.com/.test(url)) return 'gfycat';
  if (/instagram\.com\/p/.test(url)) return 'instagram';
  if (/\.(mp4|webm)$/.test(url)) return 'video';
  return 'other';
}

function getYoutubeId(url) {
  let id;
  if (url.includes('youtube.com')) {
    id = url.split('v=')[1];
  } else if (url.includes('youtu.be')) {
    const parts = url.split('/');
    id = parts[parts.length - 1];
  }
  if (!id) return null;
  const amp = id.indexOf('&');
  if (amp !== -1) id = id.substring(0, amp);
  return id;
}

function getYoutubeTime(url) {
  const m = url.match(/t=(.*)$/);
  if (!m) return 0;
  const timestr = m[1];
  if (!timestr.match('s')) return timestr;
  let seconds = parseInt(timestr.match(/(\d+)\s*s/)) || 0;
  const d = timestr.match(/(\d+)\s*d/);
  const h = timestr.match(/(\d+)\s*h/);
  const min = timestr.match(/(\d+)\s*m/);
  if (d) seconds += parseInt(d[1]) * 86400;
  if (h) seconds += parseInt(h[1]) * 3600;
  if (min) seconds += parseInt(min[1]) * 60;
  return seconds;
}

function getImgurId(url) {
  const r = /imgur\.com\/(?:gallery\/)?(?:a\/)?(\w+)(?:\..+)?/;
  const m = url.match(r);
  if (!m) return '';
  return m[1].length >= 7 ? m[1] : 'a/' + m[1];
}

function urlify(text) {
  text = text.replace(/<((https?|ftp)(:\/\/[^\s()<>]+))>/g, (_, inner) => ' ' + inner + ' ');

  return text.replace(/(https?|ftp)(:\/\/[^\s()<>]+)/g, url => {
    const cls = classify(url);
    const w = contentWidth();
    const h = w * 0.6125;

    switch (cls) {
      case 'image':
        return `<div class="div_a_pic"><a class="a_pic" href="${url}"><img loading="lazy" src="${url}" style="position:relative;margin:auto" onerror="this.closest('li').style.display='none'"/></a></div>`;

      case 'youtube': {
        const yid = getYoutubeId(url);
        if (!yid) return `<a class="a_other" href="${url}">${decodeURIComponent(url)}</a>`;
        const start = url.match(/t=/) ? getYoutubeTime(url) : 0;
        return `<div class="yt-facade" data-id="${yid}" data-start="${start}" style="background:url(https://i.ytimg.com/vi/${yid}/hqdefault.jpg) center/cover no-repeat;cursor:pointer;width:${w}px;height:${h}px;position:relative"><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:64px;color:#fff;text-shadow:0 0 8px rgba(0,0,0,.6)">&#9654;</div></div>`;
      }

      case 'coub': {
        const coubId = url.match(/coub\.com\/view\/(.*)/)[1];
        return `<div><div style="left:0;width:100%;height:0;position:relative;padding-bottom:56.249%"><iframe loading="lazy" src="https://coub.com/embed/${coubId}" frameborder="0" allowfullscreen scrolling="no" style="top:0;left:0;width:100%;height:100%;position:absolute"></iframe></div></div>`;
      }

      case 'vimeo': {
        const vimeoId = url.match(/vimeo\.com\/(.*)/)[1];
        return `<div><div style="left:0;width:100%;height:0;position:relative;padding-bottom:67.499%"><iframe loading="lazy" src="https://player.vimeo.com/video/${vimeoId}" frameborder="0" allowfullscreen scrolling="no" style="top:0;left:0;width:100%;height:100%;position:absolute"></iframe></div></div>`;
      }

      case 'gfycat': {
        const gfyId = url.match(/gfycat\.com\/(.*)/)[1];
        return `<div style="position:relative;padding-bottom:100%"><iframe loading="lazy" src="https://gfycat.com/ifr/${gfyId}" frameborder="0" scrolling="no" width="100%" height="100%" style="position:absolute;top:0;left:0" allowfullscreen></iframe></div>`;
      }

      case 'imgur':
        return `<blockquote class="imgur-embed-pub" lang="en" data-id="${getImgurId(url)}"></blockquote>`;

      case 'video':
        return `<video width="${w}" height="${h}" controls preload="none"><source src="${url}" type="video/mp4"></video>`;

      case 'twitter': {
        if (!url.match(/(\d+)$/)) return `<a class="a_other" href="${url}">${decodeURIComponent(url)}</a>`;
        const twitterUrl = url.replace('x.com', 'twitter.com');
        return `<blockquote class="twitter-tweet"><a href="${twitterUrl}"></a></blockquote>`;
      }

      case 'reddit':
        return `<blockquote class="reddit-card"><a href="${url}"></a></blockquote>`;

      case 'instagram':
        return `<blockquote class="instagram-media" style="width:${w}px"><a href="${url}"></a></blockquote>`;

      default:
        return `<a class="a_other" href="${url}">${decodeURIComponent(url)}</a>`;
    }
  });
}

// --- Event listeners ---

window.addEventListener('scroll', async () => {
  if (isLoading || getHash('message')) return;
  if ((innerHeight + scrollY) < document.body.offsetHeight - 2000) return;
  isLoading = true;
  let url = `/messages?uname=${juickName}&withrecommended=1&before_mid=${lastMid}`;
  if (currentTag) url += `&tag=${encodeURI(currentTag)}`;
  const json = await api(url);
  if (json.length > 0) appendMessages(json);
  isLoading = false;
});

document.addEventListener('click', e => {
  const el = e.target.closest('.like');
  if (!el) return;
  e.preventDefault();
  if (el._busy) return;
  el._busy = true;

  const count = Math.floor(Math.random() * 12) + 1;
  const mid = el.dataset.mid;
  const rid = el.dataset.id;
  const counter = $(mid + rid);
  counter.textContent = ((parseInt(counter.textContent) || 0) + count) + ' ';

  apiPost('/react', `mid=${mid}&reactionId=${rid}&hash=7DIS7WEOA0XQPG5Y&count=${count}`)
    .finally(() => { el._busy = false; });
});

document.addEventListener('click', e => {
  const facade = e.target.closest('.yt-facade');
  if (!facade) return;
  const iframe = document.createElement('iframe');
  iframe.width = facade.offsetWidth;
  iframe.height = facade.offsetHeight;
  iframe.src = `https://www.youtube.com/embed/${facade.dataset.id}?rel=0&start=${facade.dataset.start || 0}&autoplay=1`;
  iframe.frameBorder = '0';
  iframe.allow = 'autoplay; encrypted-media';
  iframe.allowFullscreen = true;
  facade.replaceWith(iframe);
});
