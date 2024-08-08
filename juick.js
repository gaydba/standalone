var juickTag;
var juickLastMid;
var daysback;
var maxMid=0;

function setRandomTopic() {
  var title = titles[Math.floor(Math.random()*titles.length)];
  // console.log('New title: ' + title);
  $('#hdr-text').text(title);
}

function juickInit(uname) {
  setRandomTopic();
  var message=juickGetHashVar("message");
  daysback=juickGetHashVar("daysback");
  juickTag=juickGetHashVar("tag");
  juickLastMid=juickGetHashVar("before_mid");
  if(juickLastMid) juickLastMid=parseInt(juickLastMid);
  if(!juickLastMid) juickLastMid=0;

  var msgs=document.getElementById("messages");
  while(msgs.hasChildNodes()) msgs.removeChild(msgs.lastChild);
  var replies=document.getElementById("replies");
  while(replies.hasChildNodes()) replies.removeChild(replies.lastChild);
  document.getElementById("navigation").style.display="none";

  var nodes=document.getElementsByClassName("loadScript");
  for(var i=0; i<nodes.length; i++)
    nodes[i].parentNode.removeChild(nodes[i]);
  if(message && message>0) {
    var url="//api.juick.com/thread?mid="+message;
    juickLoadScript(url, juickParseThread);
  } else if (daysback) {
    var url = "//api.juick.com/messages?uname="+uname+"&daysback="+daysback;
    juickLoadScript(url, juickParseMessages);
  } else {
    var url="//api.juick.com/messages?uname="+uname+"&withrecommended=1";
    if(juickTag && juickTag!='') url+="&tag="+encodeURI(juickTag);
    if(juickLastMid && juickLastMid>0) url+="&before_mid="+juickLastMid;
    juickLoadScript(url, juickParseMessages);
  }
}

function juickLoadScript(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send();
    callback(JSON.parse(xhr.responseText));
}

function juickParseMessages(json) {
  var msgs=document.getElementById("messages");
  var prevdate='';
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
      ihtml+='<div class="photo"><a href="'+json[i].attachment.url+'"><img src="'+json[i].attachment.url+'" alt="Photo"/></a></div>';
    if(json[i].video)
      ihtml+='<b>Attachment:</b> <a href="'+json[i].video.mp4+'">Video</a><br/>';
    if(json[i].location)
      ihtml+='<b>Location:</b> <a href="/places/'+json[i].location.place_id+'">'+json[i].location.name+'</a><br/>';
    ihtml+=juickFormatText(json[i].body || "");
    ihtml+='</div>';



    $(function() {
      $(".like").click(function (e) {
        var me = $(this);
        e.preventDefault();

        if (me.data('requestRunning')) {
          return;
        }

        me.data('requestRunning', true);
        var magicLikes = Math.floor(Math.random() * 12) + 1;

        $.post({
          url: '//api.juick.com/react',
          data: {
            mid: me.data('mid'),
            reactionId: me.data('id'),
            hash: '7DIS7WEOA0XQPG5Y',
            count: magicLikes
          },
          success: function (text) {
            var likesCounterId = me.data('mid').toString() + me.data('id').toString();
            var likesCounterVal = parseInt(document.getElementById(likesCounterId).textContent);
            if (isNaN(likesCounterVal)) {
              likesCounterVal = 0;
            }
            document.getElementById(likesCounterId).textContent = (likesCounterVal + magicLikes).toString() + ' ';
            //console.log('Success post, count:', likesCounterId, likesCounterVal, document.getElementById(likesCounterId));
          },
          complete: function () {
            me.data('requestRunning', false);
          }
        })
      });
    });

    var likesDef = {
      1: {count: 0, description: "like", emoji: "em---1"},
      2: {count: 0, description: "love", emoji:"em-heart_eyes"},
      3: {count: 0, description: "lol", emoji:"em-joy"},
      4: {count: 0, description: "hmm", emoji:"em-thinking_face"},
      5: {count: 0, description: "angry", emoji:"em-rage"},
      6: {count: 0, description: "uhblya", emoji:"em-six_pointed_star"},
      7: {count: 0, description: "ugh", emoji:"em-cry"}
    };


    var serverLikes = {};

    if(json[i].reactions){
      var likesAvailable = json[i].reactions;

      for (var q=0; q< likesAvailable.length; q++){
        var id = likesAvailable[q].id;
        serverLikes[id] = likesAvailable[q]
      }
    }


    var likes = '';
    for (var a = 1; a < 8; a++){

      var count = " ";
      if(json[i].reactions){
        if( a in serverLikes){
          var count = serverLikes[a].count;
        }
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
    if (currdate != prevdate & prevdate != '' & !(daysback>0)) {
      var pts=json[i-1].timestamp.split(/[\-\s]/);
      var pdate=new Date(pts[0],pts[1]-1,pts[2]).getTime();
      now=new Date().getTime();
      timehopoffset=Math.floor((now-pdate)/1000/3600/24) + 365;
      insertTimehop(json[i-1].mid, timehopoffset);
    }
    prevdate=currdate;
  }

  var random_mid = (Math.floor(Math.random()*(maxMid-427988+1)+427988));
  var nav='<div class=bottomnav><span class="random"><a href="#before_mid='+random_mid+'"><img src="rsz_shuffle.png"></a></span>';
  var topnav='<a href="#before_mid='+random_mid+'"><img src="rsz_shuffle.png"></a>';
  $('#topnavbutton').html(topnav);

  if (juickGetHashVar("before_mid") || (!window.location.hash)) {
    nav+='<span class="next"><a href="#before_mid='+(juickLastMid)+'">'+juickOlder+'</a></span>';
  } else if (juickTag && juickTag!='') {
    nav+='<span class="next"><a href="#tag='+juickTag+'&before_mid='+(juickLastMid)+'">'+juickOlder+'</a></span>';
  } else if(json.length>=1 && daysback>0) {
    nav+='<span class="next"><a href="#before_mid='+(juickLastMid)+'">'+juickOlder+'</a></span>';
  } else if (daysback>0) {
    nav='<div class="timehop"><a class="next" href="#daysback='+(parseInt(daysback)+1)+'">Пожалуй надо еще денек отмотать!</a></div>';
  }
  nav+='</div>';

  if(nav!="") {
    document.getElementById("navigation").innerHTML=nav;
    document.getElementById("navigation").style.display="block";
  }
  var width = window.innerWidth <= 800? window.innerWidth : 800;
  // $('.media').embedly({
  //   key: '28b3d1f4d2484dae8d8dc203320dd253',
  //   query: {
  //     maxwidth: width
  //   }
  // });

  // $(function () {
  //   var currentHash = "#";
  //   var blocksArr = $('.post');

  //   $(document).scroll(function () {
  //     var currentTop = window.pageYOffset/1;
  //     for (var i=0; i < blocksArr.length; i++){
  //       var currentElementTop = $(blocksArr[i]).offset().top;
  //       var hash = '#before_mid='+$(blocksArr[i-1]).attr('id');
  //       if (currentElementTop < currentTop && currentTop < currentElementTop + $(blocksArr[i]).height() && currentHash!=hash && i>0){
  //         history.pushState(null, null, hash);
  //       }
  //       currentHash = hash;
  //     }
  //   });
  // });
}

function insertTimehop(id, daysback) {
  // console.log(id);
  var durl = "//api.juick.com/messages?uname="+juickName+"&daysback="+daysback;
  console.log(durl);
  $.getJSON( durl).done(function( data ) {
    if (data.length>0) {
      // console.log(data);
      var timehop=document.createElement("li");
      timehop.innerHTML='<div class="timehop"><a href="#daysback='+daysback+'">Этот день год назад.</a></div>';
      $('#'+id).parent().after(timehop);
    }
  });
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

function juickFormatText(txt) {
  //console.log(txt);
  //txt=txt.replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;");
  txt=txt.replace(/\n/g,"<br/>");
  txt = urlify(txt);
  //console.log('After urlify: ', txt)
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
  } else if (/twitter.com\/.*\/status/.test(url)){
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
  // console.log(url);
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
      return '<div class="div_a_pic"><a class="a_pic" href="' + url + '">' + '<img src="'+url+'"style="position: relative; margin: auto;" onerror="this.parentNode.parentNode.parentNode.parentNode.style.display=\'none\';"/></a></div>';
    } else if (cls == 'youtube' && get_youtubeid(url)){
      var yid = get_youtubeid(url);
      // console.log('youtube link: ', url);
      // console.log('youtube video id: ', yid);
      if (url.match(/t=(.*)$/)) {
        var timeoffset = get_youtube_time(url);
      } else var timeoffset=0;
      var width = window.innerWidth <= 800? window.innerWidth : 800;
      var height = width*0.6125;
      return `<iframe width="${width}" height="${height}" src="https://www.youtube.com/embed/${yid}?rel=0&amp;start=${timeoffset}" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
    } else if (cls == 'coub') {
      var coub_id = url.match(/coub.com\/view\/(.*)/)[1];
      return `<div><div style="left: 0px; width: 100%; height: 0px; position: relative; padding-bottom: 56.249%;"><iframe src="http://coub.com/embed/${coub_id}" frameborder="0" allowfullscreen="" scrolling="no" style="top: 0px; left: 0px; width: 100%; height: 100%; position: absolute;"></iframe></div></div>`;
    } else if (cls == 'media') {
      return '<a class="media" href="' + url + '">'+decodeURIComponent(url)+'</a>';
    } else if (cls == 'gfycat') {
      let data_id = url.match(/gfycat.com\/(.*)/)[1];
      return `<div style='position:relative;padding-bottom:100%'><iframe src='https://gfycat.com/ifr/${data_id}' frameborder='0' scrolling='no' width='100%' height='100%' style='position:absolute;top:0;left:0;' allowfullscreen></iframe></div>`;
    } else if (cls == 'vimeo') {
      var vimeo_id = url.match(/vimeo.com\/(.*)/)[1];
      return `<div><div style="left: 0px; width: 100%; height: 0px; position: relative; padding-bottom: 67.499%;"><iframe src="https://player.vimeo.com/video/${vimeo_id}" frameborder="0" allowfullscreen="" scrolling="no" style="top: 0px; left: 0px; width: 100%; height: 100%; position: absolute;"></iframe></div></div>`;
    } else if (cls == 'imgur'){
      var iid = get_imgurid(url);
      // console.log('iid: ', iid);
      var a = '<blockquote class="imgur-embed-pub" lang="en" data-id="' + iid + '"></blockquote>';
      var s = document.createElement('script');
      s.type = 'text/javascript';
      s.src = 'http://s.imgur.com/min/embed.js';
      s.async = true;
      setTimeout(function(){
        // console.info('Append ', s, ' to ', document.body);
        document.body.appendChild(s);
      }, 300);
      return a
    } else if (cls == 'video') {
      var width = window.innerWidth <= 800? window.innerWidth : 800;
      var height = width*0.6125;
      return '<video width="'+width+'" height="'+height+'" controls> <source src="'+url+'" type="video/mp4"></video>';
    } else if (cls == 'twitter' && url.match(/(\d+)$/)) {
      var twid = url.match(/(\d+)$/)[1];
      // console.log('twid: ', twid);
      var s = document.createElement('script');
      s.type = 'text/javascript';
      s.src = 'https://platform.twitter.com/widgets.js';
      s.async = true;
      setTimeout(function(){
        // console.info('Append ', s, ' to ', document.body);
        document.body.appendChild(s);
      }, 300);
      return '<blockquote class="twitter-tweet"><a href="'+url+'"></a></blockquote>';
    } else if (cls == 'reddit'){
      var s = document.createElement('script');
      s.type = 'text/javascript';
      s.src = 'https://embed.redditmedia.com/widgets/platform.js';
      s.async = true;
      setTimeout(function(){
        // console.info('Append ', s, ' to ', document.body);
        document.body.appendChild(s);
      }, 300);
      return '<blockquote class="reddit-card"><a href="'+url+'"></a></blockquote>';
    } else if (cls == 'instagram'){
      var width = window.innerWidth <= 800? window.innerWidth : 800;
      var height = width*0.6125;
      var s = document.createElement('script');
      s.type = 'text/javascript';
      s.src = 'https://platform.instagram.com/en_US/embeds.js';
      s.async = true;
      setTimeout(function(){
        // console.info('Append ', s, ' to ', document.body);
        document.body.appendChild(s);
      }, 300);
      return '<blockquote class="instagram-media" style="width:'+width+'px" ><a href="'+url+'"></a></blockquote>';
    } else {
      return '<a class="a_other" href="' + url + '">'+decodeURIComponent(url)+'</a>';
    }
  })
}
