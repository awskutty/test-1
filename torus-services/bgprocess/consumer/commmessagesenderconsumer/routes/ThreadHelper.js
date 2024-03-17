/****
  @Descriptions                 : Get Data from hst_trn_attachments data from the Kafka topic
  @Last_Error_Code              : ERR-ATMT-CONSUMER-0002
 ****/

// Require dependencies
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqTranDBHelper = require('../../../../../torus-references/instance/TranDBInstance');
var reqCommonProducer = require('../../../../../torus-references/common/Producer');

// Global variable initialization
var serviceName = 'commmessagesenderThreadHelper';
var objLogInfo = null;

function SendToKafka(params, SendToKafkaCB) {
    try {
        /*   params Should Contains
              - objLogInfo
              - kafkTopicName
              - commProcessMessageData
              - headers 
              */
        var SendToKafkaResult = {};
        var headers = params.headers;
        var objLogInfo = params.objLogInfo;
        var kafkTopicName = params.kafkTopicName;
        var commProcessMessageData = params.commProcessMessageData;
        reqInstanceHelper.PrintInfo(serviceName, 'Going to Produce Data to Kfka "COMM_PROCESS_MESSAGE_SUCCESS" Topic...', objLogInfo);
        reqCommonProducer.ProduceMessage(kafkTopicName, commProcessMessageData, headers, function (status) {
            SendToKafkaResult.status = status;// SUCCESS / FAILURE
            SendToKafkaResult.strInfo = 'Producing Data to Kafka Topic Process Completed...';
            SendToKafkaCB(SendToKafkaResult);
        });
    } catch (error) {
        SendToKafkaResult.status = 'FAILURE';
        SendToKafkaResult.errorObj = error;
        SendToKafkaResult.strInfo = 'Catch Error SendToKafka...';
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_COMM_PROCESS_MESSAGE_CONSUMER_00002', SendToKafkaResult.strInfo, error);
        SendToKafkaCB(SendToKafkaResult);
    }
}

function _objKeyToUpperCase(pObj, pHeader) {
    try {
        var objForReturn = new Object();
        for (var key in pObj) {
            var strUpperCaseKey = key.toUpperCase();
            objForReturn[strUpperCaseKey] = pObj[key];
        }
        return objForReturn;
    } catch (error) {
        _TraceError(error, pHeader, 'ERR-AUDITDATA-PRODUCER-0020', 'Catch Error in _objKeyToUpperCase()...');
    }
}



// To print error messages
function _TraceError(pErrorObj, pHeader, pErrorCode, pErrInfoMesg) {
    try {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, pErrorCode, pErrInfoMesg, pErrorObj);
    }
    catch (e) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-AUDITDATA-PRODUCER-0002', 'Catch Error in _TraceError();...', e);
    }
}

// To print log info messages
function _TraceInfo(pMsg) {
    reqInstanceHelper.PrintInfo(serviceName, pMsg, objLogInfo);
}



module.exports = {
    SendToKafka: SendToKafka
}
/******** End of File **********/