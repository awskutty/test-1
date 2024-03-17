// Require dependencies
var modPath = '../../../../../node_modules/'
var reqExpress = require(modPath + 'express');
var reqLogWriter = require('../../../../../torus-references/log/trace/LogWriter')
var path = require(modPath + 'path')
var reqUuid = require(modPath + 'uuid');
var reqDBInstance = require('../../../../../torus-references/instance/DBInstance');


// Cassandra initialization
var mResClient;

//Queries
// const tranqueryimg = "insert into trna_data(TRNAD_ID,RELATIVE_PATH,TEXT_DATA) VALUES(UUID(),?,?)"
// const tranquery = "insert into trna_data(TRNAD_ID,RELATIVE_PATH,BYTE_DATA) VALUES(UUID(),?,?)"


// Initialize Global variables
var strResult = '';
var strMessage = '';
var router = reqExpress.Router();
// router.post('/AddContent', function(pReq, pResp) {
// pResp.setHeader('Content-Type', 'text/plain');
var objLogInfo = '';

function SaveAddContentFiles(arrAtmts, req, pCallback) {


  //reqDbInstance.GetCassandraConn(req.headers, 'res_cas', function Callback_GetCassandraConn(pClient) {
  reqDBInstance.GetFXDBConnection(req.headers, 'res_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
    mResClient = pClient;

    //  try {
    // var params = pReq.body;
    // var Fileparams = pReq.FileList;
    // var RelativePath = '';
    // var FILE_NAME = ''
    // var extension = ''
    // var literName = ''
    // var objLogInfo = reqLogInfo.AssignLogInfoDetail(params, pReq);
    // reqLogWriter.Eventinsert(objLogInfo)
    // var FileCount = Object.keys(Fileparams).length
    // var StrRsParams = params.RSPARAMS
    // var strAppId = params.APP_ID

    // var count = 0
    // var AttachmentDetails = new SaveAttachmentDetails
    // AttachmentDetails = JSON.parse(StrRsParams).Items
    // var arrCount = AttachmentDetails.length;


    arrAtmts.forEach(function (atmt) {
      RelativePath = atmt.RELATIVE_PATH
      var Atcode = atmt.AT_CODE
      FILE_NAME = atmt.FILE_NAME
      extension = path.extname(atmt.FILE_NAME);
      literName = path.basename(atmt.FILE_NAME, extension);
      var bytedata = atmt.BYTE_DATA;
      // for (var i = 0; i < FileCount; i++) {
      //   if (atmt.FILE_NAME == Fileparams["FILE_" + i].name)
      //     bytedata = Fileparams["FILE_" + i].data
      // }
      if (Atcode != "" && Atcode.toUpperCase() == "IMG") {
        var TextData = new Buffer.from(bytedata).toString('base64');
        //     console.log(TextData);
        //  mResClient.execute(tranqueryimg, [RelativePath.toUpperCase().trim(), bytedata], {
        //   prepare: true
        // }, function callbackcltsetup(err, result) {


        reqDBInstance.InsertFXDB(mResClient, 'TRNA_DATA', [{
          'TRNAD_ID': reqUuid.v1(),
          'RELATIVE_PATH': RelativePath.toUpperCase().trim(),
          'TEXT_DATA': bytedata,
          'APP_ID': objLogInfo.APP_ID,
          'TENANT_ID': objLogInfo.TENANT_ID
        }], objLogInfo, function (err) {

          //   count = count + 1;
          if (err) {
            console.log('execute failed' + err.toString());
            reqLogWriter.TraceError(objLogInfo, err.toString(), 'ERRXR001');
          } else {
            console.log('tran insert success');
          }
          // successcallback();
        })

      } else {
        // mResClient.execute(tranquery, [RelativePath.toUpperCase().trim(), bytedata], {
        //   prepare: true
        // }, function trandatainsert(err, result) {

        reqDBInstance.InsertFXDB(mResClient, 'TRNA_DATA', [{
          'TRNAD_ID': reqUuid.v1(),
          'RELATIVE_PATH': RelativePath.toUpperCase().trim(),
          'BYTE_DATA': bytedata,
          'APP_ID': objLogInfo.APP_ID,
          'TENANT_ID': objLogInfo.TENANT_ID
        }], objLogInfo, function (err) {


          //   count = count + 1;
          if (err) {
            console.log('execute failed' + err.toString());
            reqLogWriter.TraceError(objLogInfo, err.toString(), 'ERRXR001');
          } else {
            console.log('tran insert success');
          }
          // successcallback();
        })
      }
      //For Solr Index
      // var param = {
      //   ContentStream: '',
      //   pFilename: atmt.FILE_NAME,
      //   DT_CODE: params.DT_CODE,
      //   DTT_CODE: params.DTT_CODE,
      //   relative_path: RelativePath,
      //   literName: literName
      // }
      // reqKafkaProducer.ProduceMessage('CONTENT_DATA1', param)
      //successcallback();
    });
  });
  strResult = "SUCCESS"
  successcallback();

  // } catch (ex) {
  //   reqLogWriter.TraceError(objLogInfo, ex, 'ERRXR001');
  //   strResult = "FAILURE"
  // }

  function successcallback() {
    // if (arrCount === count) {
    pCallback(strResult);
    // }
  }

}
// })


function SaveAttachmentDetails() {
  this.RELATIVE_PATH = ""
  this.FILE_NAME = ""
  this.FILE_SIZE = ""
  this.RS_PATH = ""
  this.RS_CODE = ""
  this.TRN_ID = 0
  this.DTT_CODE = ""
  this.ATMT_DTT_CODE = ""
  this.DTTA_ID = 0
  this.DTTAD_ID = 0
  this.DTTADIF_ID = 0
  this.AT_CODE = ""
  this.BYTE_DATA = ""

}
module.exports = {
  SaveAddContentFiles: SaveAddContentFiles
};