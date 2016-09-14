/**
 * Created by xia on 16/9/1.
 */
var mongodb = require('mongodb');
var server = new mongodb.Server('ds019966.mlab.com', 19966, {auto_reconnect: true});
var db = new mongodb.Db('xia', server, {safe: true});

var userInfo = {user: 'root', password: '123456'}

var collectionName = 'mycoll';


// mongodb://<dbuser>:<dbpassword>@ds019966.mlab.com:19966/xia

//连接db
var promise = db.open();
promise.then(authenticate);
promise.then(find)
//promise.then(closeDb);
promise.catch(doError);


function closeDb() {

    db.close();
    console.log('close db!')
}

function doError(error) {
    console.log('Error!', error)

}


function createCollection(db) {
    db.createCollection('mycoll', {safe: true}, function (err, collection) {
        if (err) {
            console.log(err);
        } else {
            //新增数据
            // var tmp1 = {id:'1',title:'hello',number:1};
            //          collection.insert(tmp1,{safe:true},function(err, result){
            //              console.log(result);
            //          });
            //更新数据
            // collection.update({title:'hello'}, {$set:{number:3}}, {safe:true}, function(err, result){
            //     console.log(result);
            // });
            // 删除数据
            // collection.remove({title:'hello'},{safe:true},function(err,result){
            //                   console.log(result);
            //               });

            // console.log(collection);
            // 查询数据
            //var tmp1 = {title: 'hello'};
            //var tmp2 = {title: 'world'};
            //collection.insert([tmp1, tmp2], {safe: true}, function (err, result) {
            //    console.log(result);
            //});
            //collection.find().toArray(function (err, docs) {
            //    console.log('find');
            //    console.log(docs);
            //});
            //collection.findOne(function (err, doc) {
            //    console.log('findOne');
            //    console.log(doc);
            //});
        }

    })
}
function authenticate() {
    console.log('authenticate!');
    return db.authenticate(userInfo.user, userInfo.password);
}

function createCle(db) {
    return createCollection(db);
}

function find() {
    console.log('find...');
    var collection = db.collection(collectionName)
    //var p = collection.insert({username:'Bilbo',firstname:'Shilbo'});
    //p.then(
    //    function(){
    //        collection.find().toArray(function (err, docs) {
    //            console.log('find', docs);
    //
    //        })
    //    }
    //
    //)
    var cursor = collection.find( );
    cursor.each(function(err, doc) {
        //console.log('result:',err,doc)
        if (doc != null) {
            console.dir(doc);
        } else {
            //callback();
        }
    });


}

function insert() {
    console.log('insert..')
    var collection = db.collection(collectionName);
    return collection.insert({username: 'Bilbo', firstname: 'Shilbo'});
    //p.then(closeDb,doError);
}



