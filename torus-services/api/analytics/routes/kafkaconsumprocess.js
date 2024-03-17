/****
 * Api_Name          : /Kafkaconsumerprocess,
 * Description       : ,
 * Last_Error_Code   : ERR-ANL-5100
 ****/

// Require dependencies
var modPath = '../../../../node_modules/'
var express = require(modPath + 'express');
var kafka = require(modPath + 'kafka-node');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInsHelper = require('../../../../torus-references/common/InstanceHelper');

// Initialize Global variables
var strResult = '';
var strMessage = '';

var router = express.Router();
var client ;
var consumer;
var topics;
const options = {autoCommit: true,fetchMaxWaitMs: 1000,fetchMaxBytes: 1024 * 1024,encoding: "buffer"};
var HighLevelConsumer = kafka.HighLevelConsumer;
var Client = kafka.Client;

// Host the login api
router.post('/kafkaconsumprocess', function(appReq, appResp) {

    reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {
    reqLogWriter.Eventinsert(objLogInfo);
    objLogInfo.PROCESS = 'kafkaconsumprocess-Analytics';
    objLogInfo.ACTION = 'kafkaconsumprocess';
    var strHeader = {};

    if (appReq.headers) {
        strHeader = appReq.headers;
        strHeader.routingkey = "CLT-0~APP-0~TNT-0~ENV-0";
    }
    else {
        strHeader = { 'routingkey': 'CLT-0~APP-0~TNT-0~ENV-0' }
    }

    try {
        if(client != undefined){
          console.log("client present:"+client)
          if(consumer!= undefined){
            // consumer.close(function(err,msg){
            //   console.log("consumer closed");
              topics = [{topic: appReq.body.kf_topic}];
              consumer = new HighLevelConsumer(client, topics, options);
              console.log("Added consumer:"+ consumer);
              consumer.on("error", function(err) {
                  console.log("error", err);
                  //result.send(JSON.stringify({status: 'failure'}));
              });
            //});
          }
          else{
            topics = [{topic: appReq.body.kf_topic}];
            consumer = new HighLevelConsumer(client, topics, options);
            consumer.on("error", function(err) {
                console.log("error", err);
                //result.send(JSON.stringify({status: 'failure'}));
            });
          }
        }
        else{
          try{
                client = new Client(appReq.body.kf_host);
                console.log("new client added:"+client)
                if(consumer!= undefined){
                  // consumer.close(function(err,msg){
                  //   console.log("consumer closed");
                    topics = [{topic: appReq.body.kf_topic}];
                    consumer = new HighLevelConsumer(client, topics, options);
                    console.log("Add consumer:"+ consumer);
                    consumer.on("error", function(err) {
                        console.log("error", err);
                        //result.send(JSON.stringify({status: 'failure'}));
                    });
                  //});
                }
                else{
                  topics = [{topic: appReq.body.kf_topic}];
                  consumer = new HighLevelConsumer(client, topics, options);
                  consumer.on("error", function(err) {
                      console.log("error", err);
                      //result.send(JSON.stringify({status: 'failure'}));
                  });
                }
          }
          catch(error){
              console.log("Error:"+error)
          }
        }
        _SendResponse("Success", '', '', null, null,objLogInfo);
          consumer.on("message", function(message) {
              var buf = new Buffer.from(message.value, "binary");
              var decodedMessage = buf.toString();
              var socketParams = {"topicName":appReq.body.kf_topic,"message":{ "data": decodedMessage,"label":"Kafka_Data"}};
                    emitSocket(socketParams,function(result){
                    });
          });
    } catch (error) {
      errorHandler("ERR-ANL-111105", "Error in getting kafkatopic for kafka masters" + error)
    }
    });
    function emitSocket(params, callback) {
      reqInsHelper.EmitSocketMessage('analytics_socket', params.topicName, params.message, (result) => {
      callback(result);
      });
      }
    // To send the app response
    function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning,pobjinfo) {
      var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS'
      var ResponseData = (pResponseData == null || pResponseData == undefined) ? '' : pResponseData
      return reqInsHelper.SendResponse('Kafkaconsumerprocess', appResp, ResponseData, pobjinfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning)
  }

  function errorHandler(errcode, message) {
      console.log(errcode, message);
      reqLogWriter.TraceError(objLogInfo, message, errcode);
  }
});
module.exports = router;
