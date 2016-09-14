# nodejs爬虫
爬取某个站点下所有的网页以及静态资源

#使用例子
```javascript
var Robot = require("./robot.js");
var iStartTimestamp = Math.ceil( (new Date()).getTime() / 1000 );
var oOptions = {
    domain:'qiushibaike.com', //抓取网站的域名
    firstUrl:'http://www.qiushibaike.com/', //抓取的初始URL地址
    saveDir:"E:\\wwwroot/qiushibaike/", //抓取内容保存目录
    debug:true, //是否开启调试模式
	filterUrl:function(url){ //符合条件的URL才加入URL抓取队列中
		if(url.indexOf("text") > -1){
			return true;
		} else{
			return false;
		}
	},
	handleText:function(url,text){ //抓取文本内容的处理 this指向robot
		var text = text.replace(/[\n\r\t]/gm,'');
		var pattern = /<div\s+class="article(.*?)<div\s+class="single-clear"><\/div><\/div>/gmi;
		var aRet = [],aTmp,aTmp2,aTmp3;
		while(true){
			aTmp = pattern.exec(text);
			if(aTmp){
				aTmp2 = (/<div class="content">(.*?)<\/div>/).exec(aTmp[1]);
				aTmp3 = (/<i class="number">(\d+)<\/i>/).exec(aTmp[1]);
				if(aTmp2){
					aRet.push( JSON.stringify( {content:aTmp2[1],vote:aTmp3 ? aTmp3[1] : 0} ) );
				}
			}else{
				break;
			}
		}
		if(aRet){
			this.oFile.save("word_"+iStartTimestamp+".json",url+aRet.join("\n")+"\n","utf8",function(){},true);
		}
	},
};
var o = new Robot(oOptions);
o.crawl(); //开始抓取
```
