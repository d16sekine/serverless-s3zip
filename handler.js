'use strict';

const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const archiver = require('archiver-promise');
const fs = require('fs');
const execAsync = require('async-child-process').execAsync;

const targetBucket = 'electricity-bills';
const filenameSaved = "all.zip";

module.exports.s3zip = async (event, context) => {

  console.log("event:", event);

  let s3key = event.Records[0].s3.object.key.split("/");

  let auction_gid = parseInt(s3key[0], 10);
    
  let auction_id = parseInt(s3key[1], 10);
  
  let params_list = {
      Bucket: targetBucket,
      //Delimiter: '/',
      MaxKeys: 15,
      Prefix: auction_gid + '/' + auction_id + '/'
  };
    
  let result = await s3.listObjectsV2(params_list).promise();
      
  console.log("success:S3 List:",result);  

  for(let i =0; i < result.Contents.length; i++){
    
    let strKey = result.Contents[i].Key.toString();
    
    //zipファイルは処理しない
    if(strKey.indexOf("zip") !== -1) {
        console.log("zip file:", result.Contents[i].Key);
        continue;
    }
    
    let params_get = {
        Bucket: targetBucket,
          Key: result.Contents[i].Key
    };
    
    let result_obj = await s3.getObject(params_get).promise();
    
    var paths = result.Contents[i].Key.split('/');
    
    // tmpに保存するパス名
    let filePath = '/tmp/' + paths[2];

    // /tempにファイル保存
    fs.writeFileSync(filePath, result_obj.Body);
    console.log("getObject saved filePath:", filePath);
}

  let cmd = "ls -a /tmp"; //ここを変更する
  await asyncCmd(cmd);

  //tmpに保存するzipファイル名
  let timestamp = new Date().getTime();
  let filename_zip = filenameSaved;
  let pathname_zip = "/tmp/" + filename_zip;

  let result_archive = await asyncArchiver(pathname_zip, result.Contents);
  
  console.log("result_archive:",result_archive);

  await asyncCmd(cmd);

  //S3に保存するzipオブジェクト
  let v = fs.readFileSync(pathname_zip);

  //S3に保存するobject key
  let objkey_put = String(auction_gid) + "/" + String(auction_id) + "/" + filename_zip;
      
  console.log("S3 Key:",objkey_put);

  let result_put = await s3.putObject({
    Body: v,
    Bucket: targetBucket, 
    ContentType: "application/zip",
    Key: objkey_put
  }).promise();

  console.log("success:update:",result_put);

  return true;

};


//同期的にコマンドを実行する
async function asyncCmd(cmd){
    
  let stdout = await execAsync(cmd);

  console.log(stdout);
  return stdout;  
  
}

//同期的にファイルを圧縮する
async function asyncArchiver(pathname, Items){
    
  console.log("pathname in archiver:", pathname);

  var archive = archiver(pathname,{
      store: true
      // more options https://archiverjs.com/docs/
    });


    for(let i =0; i<Items.length; i++){

      //zipファイルは処理しない
      if(Items[i].Key.indexOf("zip") !== -1) {
          continue;
      }

      let path = Items[i].Key.split('/');
    
      // tmpに保存するパス名
      let filePath = '/tmp/' + path[2];
      archive.append(fs.createReadStream(filePath), {name: path[2]});

    }
 
  //archive.append('string cheese!', { name: 'file2.txt' });

  let result = await archive.finalize().then(function(){
      console.log('done');
      return "success";
  });
  
  return result;
}