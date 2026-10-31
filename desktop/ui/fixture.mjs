let xp=1000;function gain(){xp+=10;document.getElementById('hud').textContent=`LV. 12: ${new Intl.NumberFormat('en-US').format(xp)}K / 2,000K (${Math.round(xp/20)}%)`;}
document.getElementById('gain').onclick=gain;setInterval(gain,4000);
