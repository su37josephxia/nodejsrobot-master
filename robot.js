/**
 * @desc 网页爬虫 抓取某个站点
 *
 * @todolist
 * URL队列很大时处理
 * 302跳转
 * 处理COOKIE
 * iconv-lite解决乱码
 * 大文件偶尔异常退出
 *
 * @author WadeYu
 * @date 2015-05-28
 * @copyright by WadeYu
 * @version 0.0.1
 */

/**
 * @desc 依赖的模块
 */
var fs = require("fs");
var http = require("http");
var https = require("https");
var urlUtil = require("url");
var pathUtil = require("path");

if(!pathUtil.isAbsolute){
    pathUtil.isAbsolute = function(filename){
        if((/^(\/|[a-zA-Z]:)/).test(filename)){
            return true;
        }
        return false;
    }
}

/**
 * @desc URL功能类
 */
var Url = function(){};

/**
 * @desc 修正被访问地址分析出来的URL 返回合法完整的URL地址
 *
 * @param string url 访问地址
 * @param string url2 被访问地址分析出来的URL
 *
 * @return string || boolean
 */
Url.prototype.fix = function(url,url2){
    if(!url || !url2){
        return false;
    }
    var oUrl = urlUtil.parse(url);
    if(!oUrl["protocol"] || !oUrl["host"] || !oUrl["pathname"]){//无效的访问地址
        return false;
    }
    if(url2.substring(0,2) === "//"){
        url2 = oUrl["protocol"]+url2;
    }
    var oUrl2 = urlUtil.parse(url2);
    if(oUrl2["host"]){
        if(oUrl2["hash"]){
            delete oUrl2["hash"];
        }
        return urlUtil.format(oUrl2);
    }
    var pathname = oUrl["pathname"];
    if(pathname.indexOf('/') > -1){
        pathname = pathname.substring(0,pathname.lastIndexOf('/'));
    }
    if(url2.charAt(0) === '/'){
        pathname = '';
		url2 = url2.substring(1);
    }
    url2 = pathUtil.normalize(url2); //修正 ./ 和 ../
    url2 = url2.replace(/\\/g,'/');
    while(url2.indexOf("../") > -1){ //修正以../开头的路径
        pathname = pathUtil.dirname(pathname);
        url2 = url2.substring(3);
    }
    if(url2.indexOf('#') > -1){
        url2 = url2.substring(0,url2.lastIndexOf('#'));
    } else if(url2.indexOf('?') >　-1){
        url2 = url2.substring(0,url2.lastIndexOf('?'));
    }
    var oTmp = {
        "protocol": oUrl["protocol"],
        "host": oUrl["host"],
        "pathname": pathname + '/' + url2,
    };
    return urlUtil.format(oTmp);
};

/**
 * @desc 判断是否是合法的URL地址一部分
 *
 * @param string urlPart
 *
 * @return boolean
 */
Url.prototype.isValidPart = function(urlPart){
    if(!urlPart){
        return false;
    }
    if(urlPart.indexOf("javascript") > -1){
        return false;
    }
    if(urlPart.indexOf("mailto") > -1){
        return false;
    }
    if(urlPart.charAt(0) === '#'){
        return false;
    }
    if(urlPart === '/'){
        return false;
    }
    if(urlPart.substring(0,4) === "data"){//base64编码图片
        return false;
    }
    if(urlPart.indexOf("about:") > -1){
        return false;
    }
	if(urlPart.indexOf('{') > -1){
		return false;
	}
    return true;
};

/**
 * @desc 获取URL地址 路径部分 不包含域名以及QUERYSTRING
 *
 * @param string url
 *
 * @return string
 */
Url.prototype.getUrlPath = function(url){
    if(!url){
        return '';
    }
    var oUrl = urlUtil.parse(url);
    if(oUrl["pathname"]){
		if((/\/$/).test(oUrl["pathname"])){
			oUrl["pathname"] += "index.html";
		}else if(oUrl["pathname"].indexOf('.') === -1){
			oUrl["pathname"] += "/index.html";
		}
    }
    if(oUrl["pathname"]){
        return oUrl["pathname"].replace(/^\/+/,'');
    }
    return '';
};


/**
 * @desc 文件内容操作类
 */
var File = function(obj){
    var obj = obj || {};
    this.saveDir = obj["saveDir"] ? obj["saveDir"] : ''; //文件保存目录
};

/**
 * @desc 内容存文件
 *
 * @param string filename 文件名
 * @param mixed content 内容
 * @param string charset 内容编码
 * @param Function cb 异步回调函数
 * @param boolean bAppend
 *
 * @return boolean
 */
File.prototype.save = function(filename,content,charset,cb,bAppend){
    if(!content || !filename){
        return false;
    }
    var filename = this.fixFileName(filename);
    if(typeof cb !== "function"){
        var cb = function(err){
            if(err){
                console.log("内容保存失败 FILE:"+filename);
            }
        };
    }
    var sSaveDir = pathUtil.dirname(filename);
    var self = this;
    var cbFs = function(){
        var buffer = new Buffer(content,charset ? charset : "utf8");
        fs.open(filename, bAppend ? 'a' : 'w', 0666, function(err,fd){
            if (err){
                cb(err);
                return ;
            }
            var cb2 = function(err){
                cb(err);
                fs.close(fd);
            };
            fs.write(fd,buffer,0,buffer.length,0,cb2);
        });
    };
    fs.exists(sSaveDir,function(exists){
        if(!exists){
            self.mkdir(sSaveDir,"0777",function(){
                cbFs();
            });
        } else {
            cbFs();
        }
    });
};

/**
 * @desc 修正保存文件路径
 *
 * @param string filename 文件名
 *
 * @return string 返回完整的保存路径 包含文件名
 */
File.prototype.fixFileName = function(filename){
    if(pathUtil.isAbsolute(filename)){
        return filename;
    }
    if(this.saveDir){
        this.saveDir = this.saveDir.replace(/[\\/]$/,pathUtil.sep);
    }
    return this.saveDir + pathUtil.sep + filename;
};

/**
 * @递归创建目录
 *
 * @param string 目录路径
 * @param mode 权限设置
 * @param function 回调函数
 * @param string 父目录路径
 *
 * @return void
 */
File.prototype.mkdir = function(sPath,mode,fn,prefix){
    sPath = sPath.replace(/\\+/g,'/');
    var aPath = sPath.split('/');
    var prefix = prefix || '/';
    var sPath = prefix + aPath.shift();
    var self = this;
    var cb = function(){
        fs.mkdir(sPath,mode,function(err){
            if ( (!err) || ( ([47,-4075]).indexOf(err["errno"]) > -1 ) ){ //创建成功或者目录已存在
                if (aPath.length > 0){
                    self.mkdir( aPath.join('/'),mode,fn, sPath.replace(/\/$/,'')+'/' );
                } else {
                    fn();
                }
            } else {
                console.log(err);
                console.log('创建目录:'+sPath+'失败');
            }
        });
    };
    fs.exists(sPath,function(exists){
        if(!exists){
            cb();
        } else if(aPath.length > 0){
            self.mkdir(aPath.join('/'),mode,fn, sPath.replace(/\/$/,'')+'/' );
        } else{
            fn();
        }
    });
};

/**
 * @递归删除目录 待完善 异步不好整
 *
 * @param string 目录路径
 * @param function 回调函数
 *
 * @return void
 */
File.prototype.rmdir = function(path,fn){
    var self = this;
    fs.readdir(path,function(err,files){
        if(err){
            if(err.errno == -4052){ //不是目录
                fs.unlink(path,function(err){
                    if(!err){
                        fn(path);
                    }
                });
            }
        } else if(files.length === 0){
            fs.rmdir(path,function(err){
                if(!err){
                    fn(path);
                }
            });
        }else {
            for(var i = 0; i < files.length; i++){
                self.rmdir(path+'/'+files[i],fn);
            }
        }
    });
};

/**
 * @desc 简单日期对象
 */
var oDate = {
    time:function(){//返回时间戳 毫秒
        return (new Date()).getTime();
    },
    date:function(fmt){//返回对应格式日期
        var oDate = new Date();
        var year = oDate.getFullYear();
        var fixZero = function(num){
            return num < 10 ? ('0'+num) : num;
        };
        var oTmp = {
            Y: year,
            y: (year+'').substring(2,4),
            m: fixZero(oDate.getMonth()+1),
            d: fixZero(oDate.getDate()),
            H: fixZero(oDate.getHours()),
            i: fixZero(oDate.getMinutes()),
            s: fixZero(oDate.getSeconds()),
        };
        for(var p in oTmp){
            if(oTmp.hasOwnProperty(p)){
                fmt = fmt.replace(p,oTmp[p]);
            }
        }
        return fmt;
    },
};

/**
 * @desc 未抓取过的URL队列
 */
var aNewUrlQueue = [];

/**
 * @desc 已抓取过的URL队列
 */
var aGotUrlQueue = [];

/**
 * @desc 统计
 */
var oCnt = {
    total:0,//抓取总数
    succ:0,//抓取成功数
    fSucc:0,//文件保存成功数
};

/**
 * 可能有问题的路径的长度 超过打监控日志
 */
var sPathMaxSize = 120;

/**
 * @desc 爬虫类
 */
var Robot = function(obj){
    var obj = obj || {};
    //所在域名
    this.domain = obj.domain || '';
    //抓取开始的第一个URL
    this.firstUrl = obj.firstUrl || '';
    //唯一标识
    this.id = this.constructor.incr();
    //内容落地保存路径
    this.saveDir = obj.saveDir || '';
    //是否开启调试功能
    this.debug = obj.debug || false;
    //第一个URL地址入未抓取队列
    if(this.firstUrl){
        aNewUrlQueue.push(this.firstUrl);
    }
	//URL地址过滤 false不加入抓取队列
	this.filterUrl = typeof obj.filterUrl == 'function' ? obj.filterUrl : function(url){return true;};
	//文本内容处理
	this.handleText = typeof obj.handleText == 'function' ? obj.handleText : function(url,text){};
    //辅助对象
    this.oUrl = new Url();
    this.oFile = new File({saveDir:this.saveDir});
};

/**
 * @desc 爬虫类私有方法---返回唯一爬虫编号
 *
 * @return int
 */
Robot.id = 1;
Robot.incr = function(){
    return this.id++;
};

/**
 * @desc 爬虫开始抓取
 *
 * @return boolean
 */
Robot.prototype.crawl = function(){
    if(aNewUrlQueue.length > 0){
        var url = aNewUrlQueue.pop();
        this.sendReq(url);
        oCnt.total++;
        aGotUrlQueue.push(url);
    } else {
        if(this.debug){
            console.log("抓取结束");
            console.log(oCnt);
        }
    }
    return true;
};

/**
 * @desc 发起HTTP请求
 *
 * @param string url URL地址
 *
 * @return boolean
 */
Robot.prototype.sendReq = function(url){
    var req = '';
	var oOptions = urlUtil.parse(url);
		oOptions.headers = {
			"User-Agent":"Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.152 Safari/537.36",
		};
    if(url.indexOf("https") > -1){
        req = https.request(oOptions);
    } else {
        req = http.request(oOptions);
    }
    var self = this;
    req.on('response',function(res){
        var aType = self.getResourceType(res.headers["content-type"]);
        var data = '';
        if(aType[2] !== "binary"){
            //res.setEncoding(aType[2] ? aType[2] : "utf8");//非支持的内置编码会报错
			if((["utf8"]).indexOf(aType[2]) > -1){
				res.setEncoding(aType[2]);
			}
        } else {
            res.setEncoding("binary");
        }
        res.on('data',function(chunk){
            data += chunk;
        });
        res.on('end',function(){ //获取数据结束
            self.debug && console.log("抓取URL:"+url+"成功\n");
            self.handlerSuccess(data,aType,url);
            data = null;
        });
        res.on('error',function(){
            self.handlerFailure();
            self.debug && console.log("服务器端响应失败URL:"+url+"\n");
        });
    }).on('error',function(err){
        self.handlerFailure();
        self.debug && console.log("抓取URL:"+url+"失败\n");
    }).on('finish',function(){//调用END方法之后触发
        self.debug && console.log("开始抓取URL:"+url+"\n");
    });
    req.end();//发起请求
};

/**
 * @desc 提取HTML内容里的URL
 *
 * @param string html HTML文本
 *
 * @return []
 */
Robot.prototype.parseUrl = function(html){
    if(!html){
        return [];
    }
    var a = [];
    var aRegex = [
        /<a.*?href=['"]([^"']*)['"][^>]*>/gmi,
        /<script.*?src=['"]([^"']*)['"][^>]*>/gmi,
        /<link.*?href=['"]([^"']*)['"][^>]*>/gmi,
        /<img.*?src=['"]([^"']*)['"][^>]*>/gmi,
        /url\s*\([\\'"]*([^\(\)\+]+)[\\'"]*\)/gmi, //CSS背景
    ];
    html = html.replace(/[\n\r\t]/gm,'');
    for(var i = 0; i < aRegex.length; i++){
        do{
            var aRet = aRegex[i].exec(html);
            if(aRet){
                this.debug && this.oFile.save("_log/aParseUrl.log",aRet.join("\n")+"\n\n","utf8",function(){},true);
                //a.push(aRet[1].trim().replace(/^\/+/,'')); //删除/是否会产生问题 删除'/'会有问题(2015-10-07 17:11)
				a.push(aRet[1].trim());
            }
        }while(aRet);
    }
    return a;
};

/**
 * @desc 判断请求资源类型
 *
 * @param string  Content-Type头内容
 *
 * @return [大分类,小分类,编码类型] ["image","png","utf8"]
 */
Robot.prototype.getResourceType = function(type){
    if(!type){
        return '';
    }
    var aType = type.split('/');
        aType.forEach(function(s,i,a){
            a[i] = s.toLowerCase();
        });
    if(aType[1] && (aType[1].indexOf(';') > -1)){
        var aTmp = aType[1].split(';');
        aType[1] = aTmp[0];
        for(var i = 1; i < aTmp.length; i++){
            if(aTmp[i] && (aTmp[i].indexOf("charset") > -1)){
                aTmp2 = aTmp[i].split('=');
                aType[2] = aTmp2[1] ? aTmp2[1].replace(/^\s+|\s+$/,'').replace('-','').toLowerCase() : '';
            }
        }
    }
    if((["image"]).indexOf(aType[0]) > -1){
        aType[2] = "binary";
    }
    return aType;
};

/**
 * @desc 抓取页面内容成功调用的回调函数
 *
 * @param string str 抓取的内容
 * @param [] aType 抓取内容类型
 * @param string url 请求的URL地址
 *
 * @return void
 */
Robot.prototype.handlerSuccess = function(str,aType,url){
    if((aType[0] === "text") /*&& ((["css","html"]).indexOf(aType[1]) > -1 || )*/){ //提取URL地址
		this.handleText(url,str);


        aUrls = (url.indexOf(this.domain) > -1) ? this.parseUrl(str) : []; //非站内只抓取一次
        for(var i = 0; i < aUrls.length; i++){
            if(!this.oUrl.isValidPart(aUrls[i])){
                this.debug && this.oFile.save("_log/aInvalidRawUrl.log",url+"----"+aUrls[i]+"\n","utf8",function(){},true);
                continue;
            }
            var sUrl = this.oUrl.fix(url,aUrls[i]);
            /*if(sUrl.indexOf(this.domain) === -1){ //只抓取站点内的 这里判断会过滤掉静态资源
                continue;
            }*/
			if(!this.filterUrl(sUrl)){
				continue;
			}
            if(aNewUrlQueue.indexOf(sUrl) > -1){
                continue;
            }
            if(aGotUrlQueue.indexOf(sUrl) > -1){
                continue;
            }
            aNewUrlQueue.push(sUrl);
        }
    }
    //内容存文件
    var sPath = this.oUrl.getUrlPath(url);
    var self = this;
    var oTmp = urlUtil.parse(url);
    if(oTmp["hostname"]){//路径包含域名 防止文件保存时因文件名相同被覆盖
        sPath = sPath.replace(/^\/+/,'');
        sPath = oTmp["hostname"]+pathUtil.sep+sPath;
    }
    if(sPath){
        if(this.debug){
            this.oFile.save("_log/urlFileSave.log",url+"--------"+sPath+"\n","utf8",function(){},true);
        }
        if(sPath.length > sPathMaxSize){ //可能有问题的路径 打监控日志
            this.oFile.save("_log/sPathMaxSizeOverLoad.log",url+"--------"+sPath+"\n","utf8",function(){},true);
            return ;
        }
        if(aType[2] != "binary"){//只支持UTF8编码
            aType[2] = "utf8";
        }
        this.oFile.save(sPath,str,aType[2] ? aType[2] : "utf8",function(err){
            if(err){
                self.debug && console.log("Path:"+sPath+"存文件失败");
            } else {
                oCnt.fSucc++;
            }
        });
    }
    oCnt.succ++;
    this.crawl();//继续抓取
};

/**
 * @desc 抓取页面失败调用的回调函数
 *
 * @return void
 */
Robot.prototype.handlerFailure = function(){
    this.crawl();
};

/**
 * @desc 外部引用
 */
module.exports = Robot;
