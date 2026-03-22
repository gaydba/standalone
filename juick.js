var juickApi = location.hostname === 'localhost' ? '/api' : '//api.juick.com';
var juickTag;
var juickLastMid;
var maxMid=0;
var isLoading=false;
var currentTag='';
var feedCache=null;

window.addEventListener('scroll', function() {
  if (isLoading) return;
  if (juickGetHashVar("message")) return;
  if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 2000) {
    isLoading = true;
    var url = juickApi+"/messages?uname="+juickName+"&withrecommended=1&before_mid="+juickLastMid;
    if (currentTag) url += "&tag="+encodeURI(currentTag);
    juickLoadScript(url, function(json) {
      if (json.length > 0) juickAppendMessages(json);
      isLoading = false;
    });
  }
});

document.addEventListener('click', function(e) {
  var el = e.target.closest('.like');
  if (!el) return;
  e.preventDefault();
  if (el._requestRunning) return;
  el._requestRunning = true;
  var magicLikes = Math.floor(Math.random() * 12) + 1;
  var mid = el.getAttribute('data-mid');
  var reactionId = el.getAttribute('data-id');
  var likesCounterId = mid + reactionId;
  var counter = document.getElementById(likesCounterId);
  var val = parseInt(counter.textContent) || 0;
  counter.textContent = (val + magicLikes) + ' ';
  var xhr = new XMLHttpRequest();
  xhr.open('POST', juickApi+'/react', true);
  xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
  xhr.onloadend = function() { el._requestRunning = false; };
  xhr.send('mid=' + mid + '&reactionId=' + reactionId + '&hash=7DIS7WEOA0XQPG5Y&count=' + magicLikes);
});

function setRandomTopic() {
  var title = titles[Math.floor(Math.random()*titles.length)];
  document.getElementById('hdr-text').textContent = title;
}

function juickInit(uname) {
  setRandomTopic();
  isLoading = false;
  var message=juickGetHashVar("message");
  juickTag=juickGetHashVar("tag");
  juickLastMid=juickGetHashVar("before_mid");
  if(juickLastMid) juickLastMid=parseInt(juickLastMid);
  if(!juickLastMid) juickLastMid=0;

  var msgs=document.getElementById("messages");
  var replies=document.getElementById("replies");

  if(message && message>0) {
    // сохраняем ленту перед открытием треда
    if (msgs.childNodes.length > 0) {
      feedCache = {
        html: msgs.innerHTML,
        scrollY: window.scrollY,
        lastMid: juickLastMid,
        tag: currentTag,
        prevdate: prevdate
      };
    }
    while(msgs.hasChildNodes()) msgs.removeChild(msgs.lastChild);
    while(replies.hasChildNodes()) replies.removeChild(replies.lastChild);
    var url=juickApi+"/thread?mid="+message;
    juickLoadScript(url, juickParseThread);
  } else if (feedCache) {
    // возврат из треда — восстанавливаем ленту
    while(replies.hasChildNodes()) replies.removeChild(replies.lastChild);
    msgs.innerHTML = feedCache.html;
    juickLastMid = feedCache.lastMid;
    currentTag = feedCache.tag;
    prevdate = feedCache.prevdate;
    var scrollY = feedCache.scrollY;
    feedCache = null;
    setTimeout(function(){ window.scrollTo(0, scrollY); }, 0);
  } else {
    feedCache = null;
    while(msgs.hasChildNodes()) msgs.removeChild(msgs.lastChild);
    while(replies.hasChildNodes()) replies.removeChild(replies.lastChild);
    var url=juickApi+"/messages?uname="+uname+"&withrecommended=1";
    if(juickTag && juickTag!='') url+="&tag="+encodeURI(juickTag);
    if(juickLastMid && juickLastMid>0) url+="&before_mid="+juickLastMid;
    juickLoadScript(url, juickParseMessages);
  }
}

function juickLoadScript(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onload = function() {
        callback(JSON.parse(xhr.responseText));
    };
    xhr.send();
}

var likesDef = {
  1: {count: 0, description: "like", emoji: "em---1"},
  2: {count: 0, description: "love", emoji:"em-heart_eyes"},
  3: {count: 0, description: "lol", emoji:"em-joy"},
  4: {count: 0, description: "hmm", emoji:"em-thinking_face"},
  5: {count: 0, description: "angry", emoji:"em-rage"},
  6: {count: 0, description: "uhblya", emoji:"em-six_pointed_star"},
  7: {count: 0, description: "ugh", emoji:"em-cry"}
};

var prevdate='';

function juickAppendMessages(json) {
  var msgs=document.getElementById("messages");
  for(var i=0; i<json.length; i++) {
    juickLastMid = json[i].mid;
    if (maxMid < juickLastMid) maxMid=parseInt(juickLastMid);

    var ts=json[i].timestamp.split(/[\-\s]/);
    var date=new Date(ts[0],ts[1]-1,ts[2]);
    var ihtml='<div class=post id='+juickLastMid+'>';
    var currdate=date.getDate()+' '+date.getMonthName()+' '+(1900+date.getYear());

    if(json[i].tags) {
      ihtml+='<div><ul class="tags">';
      for(var n=0; n<json[i].tags.length; n++)
        ihtml+='<li><a href="#tag='+json[i].tags[n]+'">'+json[i].tags[n]+'</a></li>';
      ihtml+='</ul></div>';
    }

    ihtml+='<div class="text">';
    if(json[i].photo)
      ihtml+='<div class="photo"><a href="'+json[i].attachment.url+'"><img loading="lazy" src="'+json[i].attachment.url+'" alt="Photo"/></a></div>';
    if(json[i].video)
      ihtml+='<b>Attachment:</b> <a href="'+json[i].video.mp4+'">Video</a><br/>';
    if(json[i].location)
      ihtml+='<b>Location:</b> <a href="/places/'+json[i].location.place_id+'">'+json[i].location.name+'</a><br/>';
    ihtml+=juickFormatText(json[i].body || "");
    ihtml+='</div>';

    var serverLikes = {};
    if(json[i].reactions){
      var likesAvailable = json[i].reactions;
      for (var q=0; q< likesAvailable.length; q++){
        serverLikes[likesAvailable[q].id] = likesAvailable[q];
      }
    }

    var likes = '';
    for (var a = 1; a < 8; a++){
      var count = " ";
      if(json[i].reactions && a in serverLikes){
        count = serverLikes[a].count;
      }
      likes += '<span class="likes-pair"><a class="like" data-id="' + a + '" data-mid="' + json[i].mid + '">'
              + '<i class="em '+likesDef[a].emoji +'"></i></a>'
              + '<span class="counter" id="' + json[i].mid + a + '">' + count + ' ' + '</span></span>';
    }

    ihtml += '<div class="meta">';
    if (!juickGetHashVar("message")) {
      ihtml+='<span class="likes" >'+ likes+
          '</span><span class="timestamp"><a href="#message='+json[i].mid+'">'+currdate+'</a></span></div>';
    } else { ihtml+='<span class="timestamp">' + currdate+'</span></div>'; }

    ihtml+='</div>';

    var li=document.createElement("li");
    li.innerHTML=ihtml;
    msgs.appendChild(li);

    if (currdate != prevdate & prevdate != '' & i > 0) {
      var pts=json[i-1].timestamp.split(/[\-\s]/);
      var pdate=new Date(pts[0],pts[1]-1,pts[2]).getTime();
      now=new Date().getTime();
      timehopoffset=Math.floor((now-pdate)/1000/3600/24) + 365;
      insertTimehop(json[i-1].mid, timehopoffset);
    }
    prevdate=currdate;
  }

  var topnav='<a href="#" onclick="randomDay();return false"><img src="rsz_shuffle.png"></a>';
  document.getElementById('topnavbutton').innerHTML = topnav;
  loadEmbedScripts();
}

function juickParseMessages(json) {
  prevdate='';
  currentTag = juickTag || '';
  juickAppendMessages(json);
}

function randomDay(retries) {
  retries = retries || 0;
  if (retries > 10) { window.location.hash = '#'; return; }
  var maxDays = Math.floor((Date.now() - new Date(2009,11,17).getTime()) / 86400000);
  var day = Math.floor(Math.random() * maxDays) + 1;
  juickLoadScript(juickApi+"/messages?uname="+juickName+"&daysback="+day, function(json) {
    if (json.length > 0) {
      window.location.hash = '#before_mid=' + (parseInt(json[0].mid) + 1);
    } else {
      randomDay(retries + 1);
    }
  });
}

function insertTimehop(id, daysback) {
  var durl = juickApi+"/messages?uname="+juickName+"&daysback="+daysback;
  var xhr = new XMLHttpRequest();
  xhr.open('GET', durl, true);
  xhr.onload = function() {
    var data = JSON.parse(xhr.responseText);
    if (data.length > 0) {
      var mid = parseInt(data[0].mid) + 1;
      var timehop = document.createElement("li");
      timehop.innerHTML = '<div class="timehop"><a href="#before_mid='+mid+'">Этот день год назад.</a></div>';
      var post = document.getElementById(id);
      if (post && post.parentNode) {
        post.parentNode.parentNode.insertBefore(timehop, post.parentNode.nextSibling);
      }
    }
  };
  xhr.send();
}

function juickParseThread(json) {
  var msg=new Array();
  msg[0]=json[0];
  juickParseMessages(msg);

  var replies=document.getElementById("replies");
  for(var i=1; i<json.length; i++) {

    var ihtml='<div class="username"><a href="http://juick.com/'+json[i].user.uname+'/">@'+json[i].user.uname+'</a>:</div>';

    ihtml+='<div class="text">';
    if(json[i].photo)
      ihtml+='<div class="photo"><a href="'+json[i].photo.medium+'"><img src="'+json[i].photo.small+'" alt="Photo"/></a></div>';
    if(json[i].video)
      ihtml+='<b>Attachment:</b> <a href="'+json[i].video.mp4+'">Video</a><br/>';
    ihtml+=juickFormatText(json[i].body);
    ihtml+='</div>';

    var li=document.createElement("li");
    li.style.backgroundImage='url(http://i.juick.com/as/'+json[i].user.uid+'.png)';
    li.innerHTML=ihtml;
    replies.appendChild(li);
  }
}

function juickGetHashVar(variable) {
  var query=window.location.hash.substring(1);
  if (query[0] == '!' && variable == 'message') {
    return query.substring(1);
  }
  var vars=query.split("&");
  for(var i=0; i<vars.length; i++) {
    var pair=vars[i].split("=");
    if(pair[0]==variable) return pair[1];
  }
}

function escapeHtml(txt) {
  return txt.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function juickFormatText(txt) {
  txt = escapeHtml(txt);
  txt = txt.replace(/\n/g,"<br/>");
  txt = urlify(txt);
  return txt;
}

function is_img(url){
  var imgRegex = /\.(jpg|png|gif|jpeg|svg)((\?|:).+)?$/;
  return imgRegex.test(url);
}

function classify(url){
  if (is_img(url)){
    return 'image'
  } else if (/(youtube|youtu).(com|be)/.test(url)){
    return 'youtube'
  } else if (/vimeo.com/.test(url)){
    return 'vimeo'
  } else if (/reddit.com\/r\/.*\/comments/.test(url)) {
    return 'reddit'
  } else if (/reddituploads/.test(url)) {
    return 'image'
  } else if (/^https?:\/\/(?:i.)?imgur.com/.test(url)) {
    return 'imgur'
  } else if (/coub.com\/view/.test(url)){
    return 'coub'
  } else if (/(twitter|x).com\/.*\/status/.test(url)){
    return 'twitter'
  } else if (/gfycat.com/.test(url)){
    return 'gfycat'
  } else if (/instagram.com\/p/.test(url)){
    return 'instagram'
  } else if (/\.(mp4|webm)$/.test(url)) {
    return 'video'
  } else {
    return 'other'
  }
}

function get_youtubeid(url){

  if (url.indexOf('youtube.com') >= 0){
    var video_id = url.split('v=')[1];

  } else if (url.indexOf('youtu.be') >= 0) {
    var s = url.split('/');
    var video_id = s[s.length-1];
  }
  if (!video_id){ return };
  var ampersandPosition = video_id.indexOf('&');
  if(ampersandPosition != -1) {
    video_id = video_id.substring(0, ampersandPosition);
  }
  return video_id
}

function getSeconds(str) {
  var seconds = parseInt(str.match(/(\d+)\s*s/));
  var days = str.match(/(\d+)\s*d/);
  var hours = str.match(/(\d+)\s*h/);
  var minutes = str.match(/(\d+)\s*m/);
  if (days) { seconds += parseInt(days[1])*86400; }
  if (hours) { seconds += parseInt(hours[1])*3600; }
  if (minutes) { seconds += parseInt(minutes[1])*60; }
  return seconds;
}
function get_youtube_time(url) {
  let timestr = url.match(/t=(.*)$/)[1];
  if (!timestr.match('s')) {
    return timestr;
  } else timeoffset = getSeconds(timestr)
  return timeoffset;
}

function get_imgurid(url){
    var r = /imgur.com\/(?:gallery\/)?(?:a\/)?(\w+)(?:\..+)?/;
  if (r.test(url)) {
    var i = url.match(r)[1];
    if (i.length >= 7){
      return i;
    } else {
      return 'a/'+i;
    }
  } else {
    return ''
  }
}

var loadedScripts = {};
function loadScriptOnce(src, onload) {
  if (loadedScripts[src]) {
    if (onload) onload();
    return;
  }
  loadedScripts[src] = true;
  var s = document.createElement('script');
  s.src = src;
  s.async = true;
  if (onload) s.onload = onload;
  document.body.appendChild(s);
}

function hideDeadEmbeds() {
  // twitter: если blockquote не заменён на iframe — твит протух
  document.querySelectorAll('.twitter-tweet').forEach(function(el) {
    el.closest('li').style.display = 'none';
  });
  // imgur: blockquote без iframe внутри
  document.querySelectorAll('.imgur-embed-pub').forEach(function(el) {
    if (!el.nextElementSibling || el.nextElementSibling.tagName !== 'IFRAME') {
      el.closest('li').style.display = 'none';
    }
  });
}

function loadEmbedScripts() {
  if (document.querySelector('.twitter-tweet'))
    loadScriptOnce('https://platform.twitter.com/widgets.js', function() {
      if (window.twttr && twttr.widgets) twttr.widgets.load();
    });
  if (document.querySelector('.imgur-embed-pub'))
    loadScriptOnce('https://s.imgur.com/min/embed.js');
  if (document.querySelector('.reddit-card'))
    loadScriptOnce('https://embed.redditmedia.com/widgets/platform.js');
  if (document.querySelector('.instagram-media'))
    loadScriptOnce('https://platform.instagram.com/en_US/embeds.js');
  setTimeout(hideDeadEmbeds, 5000);
}

document.addEventListener('click', function(e) {
  var facade = e.target.closest('.yt-facade');
  if (!facade) return;
  var yid = facade.getAttribute('data-id');
  var start = facade.getAttribute('data-start') || 0;
  var width = facade.offsetWidth;
  var height = facade.offsetHeight;
  var iframe = document.createElement('iframe');
  iframe.width = width;
  iframe.height = height;
  iframe.src = 'https://www.youtube.com/embed/' + yid + '?rel=0&start=' + start + '&autoplay=1';
  iframe.frameBorder = '0';
  iframe.allow = 'autoplay; encrypted-media';
  iframe.allowFullscreen = true;
  facade.replaceWith(iframe);
});

function urlify(text) {
  var adiumUrlRegex = /<((https?|ftp)(:\/\/[^\s()<>]+))>/g;
  if (adiumUrlRegex.test(text)){
    text = text.replace(adiumUrlRegex, function(_, inner){
      return ' '+inner+' '
    });
  }
  var urlRegex = /(https?|ftp)(:\/\/[^\s()<>]+)/g;

  return text.replace(urlRegex, function(url) {
    var cls = classify(url);
  if (cls == 'image'){
      return '<div class="div_a_pic"><a class="a_pic" href="' + url + '">' + '<img loading="lazy" src="'+url+'" style="position: relative; margin: auto;" onerror="this.parentNode.parentNode.parentNode.parentNode.style.display=\'none\';"/></a></div>';
    } else if (cls == 'youtube' && get_youtubeid(url)){
      var yid = get_youtubeid(url);
      if (url.match(/t=(.*)$/)) {
        var timeoffset = get_youtube_time(url);
      } else var timeoffset=0;
      var width = window.innerWidth <= 800? window.innerWidth : 800;
      var height = width*0.6125;
      return `<div class="yt-facade" data-id="${yid}" data-start="${timeoffset}" style="background:url(https://i.ytimg.com/vi/${yid}/hqdefault.jpg) center/cover no-repeat;cursor:pointer;width:${width}px;height:${height}px;position:relative;"><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:64px;color:#fff;text-shadow:0 0 8px rgba(0,0,0,.6);">&#9654;</div></div>`;
    } else if (cls == 'coub') {
      var coub_id = url.match(/coub.com\/view\/(.*)/)[1];
      return `<div><div style="left: 0px; width: 100%; height: 0px; position: relative; padding-bottom: 56.249%;"><iframe loading="lazy" src="https://coub.com/embed/${coub_id}" frameborder="0" allowfullscreen="" scrolling="no" style="top: 0px; left: 0px; width: 100%; height: 100%; position: absolute;"></iframe></div></div>`;
    } else if (cls == 'media') {
      return '<a class="media" href="' + url + '">'+decodeURIComponent(url)+'</a>';
    } else if (cls == 'gfycat') {
      let data_id = url.match(/gfycat.com\/(.*)/)[1];
      return `<div style='position:relative;padding-bottom:100%'><iframe loading="lazy" src='https://gfycat.com/ifr/${data_id}' frameborder='0' scrolling='no' width='100%' height='100%' style='position:absolute;top:0;left:0;' allowfullscreen></iframe></div>`;
    } else if (cls == 'vimeo') {
      var vimeo_id = url.match(/vimeo.com\/(.*)/)[1];
      return `<div><div style="left: 0px; width: 100%; height: 0px; position: relative; padding-bottom: 67.499%;"><iframe loading="lazy" src="https://player.vimeo.com/video/${vimeo_id}" frameborder="0" allowfullscreen="" scrolling="no" style="top: 0px; left: 0px; width: 100%; height: 100%; position: absolute;"></iframe></div></div>`;
    } else if (cls == 'imgur'){
      var iid = get_imgurid(url);
      return '<blockquote class="imgur-embed-pub" lang="en" data-id="' + iid + '"></blockquote>';
    } else if (cls == 'video') {
      var width = window.innerWidth <= 800? window.innerWidth : 800;
      var height = width*0.6125;
      return '<video width="'+width+'" height="'+height+'" controls preload="none"> <source src="'+url+'" type="video/mp4"></video>';
    } else if (cls == 'twitter' && url.match(/(\d+)$/)) {
      const twitterUrl = url.replace('x.com', 'twitter.com');
      return '<blockquote class="twitter-tweet"><a href="'+twitterUrl+'"></a></blockquote>';
    } else if (cls == 'reddit'){
      return '<blockquote class="reddit-card"><a href="'+url+'"></a></blockquote>';
    } else if (cls == 'instagram'){
      var width = window.innerWidth <= 800? window.innerWidth : 800;
      return '<blockquote class="instagram-media" style="width:'+width+'px" ><a href="'+url+'"></a></blockquote>';
    } else {
      return '<a class="a_other" href="' + url + '">'+decodeURIComponent(url)+'</a>';
    }
  })
}